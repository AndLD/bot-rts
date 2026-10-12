import { ControlMessage, EngineMessage } from '../application/engine-protocol'
import { EngineProcess, WorkerLike } from './engine-process'

class FakeWorker implements WorkerLike {
  readonly sent: ControlMessage[] = []
  terminated = false
  private readonly listeners: { [event: string]: Array<(arg: never) => void> } = {}

  postMessage(message: ControlMessage) {
    this.sent.push(message)
  }
  on(event: string, listener: (arg: never) => void) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener]
  }
  async terminate() {
    this.terminated = true
    return 0
  }
  emit(event: string, arg?: unknown) {
    this.listeners[event]?.forEach((listener) => listener(arg as never))
  }
}

function setup(overrides: { stopTimeoutMs?: number; readyTimeoutMs?: number } = {}) {
  const workers: FakeWorker[] = []
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const engine = new EngineProcess({
    spawn: () => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    },
    logger,
    readyTimeoutMs: overrides.readyTimeoutMs ?? 1000,
    stopTimeoutMs: overrides.stopTimeoutMs ?? 1000,
    respawnDelayMs: 5
  })
  return { engine, workers, logger }
}

const ready: EngineMessage = { kind: 'ready' }

describe('EngineProcess', () => {
  it('starts when the engine says it is ready, and routes requests and replies', async () => {
    const { engine, workers } = setup()
    const started = engine.start()
    workers[0].emit('message', ready)
    await started

    const listing = engine.port.list('u')
    expect(workers[0].sent).toEqual([{ kind: 'request', id: 1, request: { op: 'list', userId: 'u' } }])
    workers[0].emit('message', { kind: 'reply', id: 1, data: [] })

    await expect(listing).resolves.toEqual([])
  })

  it('fails to start when the engine does not announce itself in time or errors first', async () => {
    const slow = setup({ readyTimeoutMs: 5 })
    await expect(slow.engine.start()).rejects.toThrow('did not start in time')

    const broken = setup()
    const starting = broken.engine.start()
    broken.workers[0].emit('error', new Error('boom'))
    await expect(starting).rejects.toThrow('boom')
    expect(broken.logger.error).toHaveBeenCalled()
  })

  it('starts the engine again after it died, failing the requests that waited for it', async () => {
    const { engine, workers, logger } = setup()
    const started = engine.start()
    workers[0].emit('message', ready)
    await started
    const waiting = engine.port.metrics()
    waiting.catch(() => undefined)

    workers[0].emit('exit', 1)
    await expect(waiting).rejects.toMatchObject({ statusCode: 503 })
    await expect(engine.port.metrics()).rejects.toMatchObject({ statusCode: 503 })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(workers).toHaveLength(2)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('code 1'))
    workers[1].emit('message', ready)
    const metrics = engine.port.metrics()
    workers[1].emit('message', { kind: 'failure', id: 3, error: { statusCode: 500, code: 'X', message: 'm' } })
    await expect(metrics).rejects.toMatchObject({ code: 'X' })
  })

  it('stops the engine on request and does not restart it', async () => {
    const { engine, workers } = setup()
    const started = engine.start()
    workers[0].emit('message', ready)
    await started

    const closing = engine.close()
    expect(workers[0].sent).toContainEqual({ kind: 'stop' })
    workers[0].emit('message', { kind: 'stopped' })
    await closing
    workers[0].emit('exit', 0)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(workers[0].terminated).toBe(true)
    expect(workers).toHaveLength(1)
  })

  it('ends the engine anyway when it does not confirm the stop in time, and closing twice is harmless', async () => {
    const { engine, workers } = setup({ stopTimeoutMs: 5 })
    const started = engine.start()
    workers[0].emit('message', ready)
    await started

    await engine.close()
    await engine.close()

    expect(workers[0].terminated).toBe(true)
  })

  it('has nothing to close when it never started', async () => {
    await expect(setup().engine.close()).resolves.toBeUndefined()
  })

  it('ignores an exit of a worker it no longer uses', async () => {
    const { engine, workers, logger } = setup()
    const started = engine.start()
    workers[0].emit('message', ready)
    await started
    await engine.close()

    workers[0].emit('exit', 1)

    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe('EngineProcess watchdog', () => {
  async function watched(onStall: (id: string) => Promise<void> = async () => undefined) {
    let state: { sequence: number; executionId: string | null } = { sequence: 0, executionId: null }
    let time = 0
    const workers: FakeWorker[] = []
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const stall = jest.fn(onStall)
    const engine = new EngineProcess({
      spawn: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
      logger,
      readyTimeoutMs: 1000,
      stopTimeoutMs: 1000,
      respawnDelayMs: 5,
      watchdog: {
        reader: {
          read: () => state,
          clear: () => {
            state = { sequence: state.sequence + 1, executionId: null }
          }
        },
        stallMs: 1000,
        pollMs: 10,
        onStall: stall,
        now: () => time
      }
    })
    const started = engine.start()
    workers[0].emit('message', ready)
    await started
    const poll = async (set: Partial<typeof state> = {}, advance = 0) => {
      state = { ...state, ...set }
      time += advance
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    return { engine, workers, logger, stall, poll }
  }

  it('ends the thread and names the script when one step lasts longer than the allowed time', async () => {
    const { engine, workers, stall, poll } = await watched()

    await poll({ sequence: 1, executionId: 'exec-1' })
    await poll({}, 1500)

    expect(workers[0].terminated).toBe(true)
    expect(stall).toHaveBeenCalledWith('exec-1')
    await engine.close()
  })

  it('leaves an engine alone that goes on stepping, that is between steps, or whose step is still young', async () => {
    const { engine, workers, stall, poll } = await watched()

    await poll({ sequence: 1, executionId: 'exec-1' })
    await poll({ sequence: 2, executionId: null }, 5000)
    await poll({ sequence: 3, executionId: 'exec-2' }, 5000)
    await poll({}, 500)

    expect(workers[0].terminated).toBe(false)
    expect(stall).not.toHaveBeenCalled()
    await engine.close()
  })

  it('does not judge a stall twice, and logs a failure to deal with it', async () => {
    const { engine, stall, poll, logger } = await watched(async () => {
      throw new Error('db down')
    })

    await poll({ sequence: 1, executionId: 'exec-1' })
    await poll({}, 1500)
    await poll({}, 1500)

    expect(stall).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalled()
    await engine.close()
  })

  it('passes on an event as if the engine had sent it, and runs without a watchdog', async () => {
    const { engine, workers } = setup()
    const started = engine.start()
    workers[0].emit('message', ready)
    await started
    const heard: unknown[] = []
    engine.port.onEvent((event) => heard.push(event))

    engine.announce({ type: 'log', executionId: 'e', botId: 'b', userId: 'u', kind: 'error', text: 'x' })

    expect(heard).toHaveLength(1)
    await engine.close()
  })
})
