import { ErrorCode } from '../../../../lib/utils/error-codes'
import { EngineCore } from '../application/engine-core'
import { ControlMessage, EngineMessage, MessageChannel } from '../application/engine-protocol'
import { EngineEvent } from '../application/engine-ports'
import { ExecutionView } from '../domain/execution'
import { ChannelSink, EngineHost } from './engine-host'
import { ChannelEnginePort, DisabledEnginePort } from './worker-engine-port'

// Two ends of an in-memory link between "threads"
function link() {
  let toEngine: (message: ControlMessage) => void = () => undefined
  let toApi: (message: EngineMessage) => void = () => undefined
  const sent: EngineMessage[] = []
  const engineSide: MessageChannel<ControlMessage, EngineMessage> = {
    post: (message) => {
      sent.push(message)
      toApi(message)
    },
    onMessage: (handler) => void (toEngine = handler)
  }
  const apiSide: MessageChannel<EngineMessage, ControlMessage> = {
    post: (message) => toEngine(message),
    onMessage: (handler) => void (toApi = handler)
  }
  return { engineSide, apiSide, sent }
}

const view: ExecutionView = {
  id: 'e1',
  botId: 'b1',
  file: '/m/a.js',
  args: [],
  state: 'queued',
  reason: null,
  restarts: 0
}

function fakeCore() {
  return {
    start: jest.fn(async () => view),
    kill: jest.fn(async () => ({ ...view, state: 'killed' as const })),
    list: jest.fn(async () => [view]),
    link: jest.fn(async () => ({ isConnected: true, signal: 4, hops: 0 })),
    act: jest.fn(async (name: string, args: unknown[]) => ({ ran: name, args })),
    snapshot: jest.fn(() => ({
      tick: 3,
      lastTickMs: 1,
      p95TickMs: 1,
      overrunTicks: 0,
      cutTicks: 0,
      executions: 1,
      memoryBytes: 9
    })),
    runTick: jest.fn(async () => undefined),
    recover: jest.fn(async () => undefined),
    shutdown: jest.fn(async () => undefined)
  }
}

function setup() {
  const { engineSide, apiSide, sent } = link()
  const core = fakeCore()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const timers = { now: () => 0, after: jest.fn(() => () => undefined) }
  const host = new EngineHost(core as unknown as EngineCore, engineSide, logger, 100, timers)
  const port = new ChannelEnginePort(apiSide)
  return { host, port, core, logger, sent, engineSide, timers }
}

function setupStop() {
  const { engineSide, apiSide, sent } = link()
  const core = fakeCore()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  new EngineHost(core as unknown as EngineCore, engineSide, logger, 100, { now: () => 0, after: () => () => undefined })
  return { apiSide, sent, core }
}

describe('EngineHost and ChannelEnginePort', () => {
  it('forwards each request to the core and returns its answer', async () => {
    const { port, core } = setup()

    await expect(port.start({ userId: 'u', botId: 'b', file: '/m/a.js', args: [1] })).resolves.toEqual(view)
    await expect(port.kill('u', 'e1')).resolves.toMatchObject({ state: 'killed' })
    await expect(port.list('u')).resolves.toEqual([view])
    await expect(port.metrics()).resolves.toMatchObject({ tick: 3 })
    await expect(port.linkStatus('u', 'b')).resolves.toMatchObject({ isConnected: true, signal: 4 })
    await expect(port.act('files.remove', ['u', 'b', 'd', 'a.js'])).resolves.toEqual({
      ran: 'files.remove',
      args: ['u', 'b', 'd', 'a.js']
    })

    expect(core.start).toHaveBeenCalledWith({ userId: 'u', botId: 'b', file: '/m/a.js', args: [1] })
    expect(core.kill).toHaveBeenCalledWith('u', 'e1')
    expect(core.list).toHaveBeenCalledWith('u')
    expect(core.link).toHaveBeenCalledWith('u', 'b')
    expect(core.act).toHaveBeenCalledWith('files.remove', ['u', 'b', 'd', 'a.js'])
  })

  it('carries an application error across with its status and code, and hides other errors', async () => {
    const { port, core, logger } = setup()
    const { AppError } = await import('../../shared/domain/app-error')
    core.kill.mockRejectedValueOnce(new AppError(403, ErrorCode.FORBIDDEN, 'not yours'))
    core.list.mockRejectedValueOnce(new TypeError('bug'))

    await expect(port.kill('u', 'e1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'not yours'
    })
    await expect(port.list('u')).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal error'
    })
    expect(logger.error).toHaveBeenCalledWith(expect.any(TypeError))
  })

  it('delivers the engine events to the listeners until they unsubscribe', () => {
    const { engineSide, apiSide } = link()
    const port = new ChannelEnginePort(apiSide)
    const sink = new ChannelSink(engineSide)
    const seen: EngineEvent[] = []
    const off = port.onEvent((event) => seen.push(event))
    const event: EngineEvent = { type: 'execution', userId: 'u', execution: view }

    sink.emit(event)
    off()
    sink.emit(event)

    expect(seen).toEqual([event])
  })

  it('recovers, starts ticking and announces itself, and stops cleanly', async () => {
    const { host, core, sent, timers } = setup()

    await host.start()
    expect(core.recover).toHaveBeenCalled()
    expect(timers.after).toHaveBeenCalledWith(100, expect.any(Function))
    expect(sent).toContainEqual({ kind: 'ready' })

    await host.stop()
    expect(core.shutdown).toHaveBeenCalled()
  })

  it('finishes and says so when told to stop', async () => {
    const { apiSide, sent, core } = setupStop()

    apiSide.post({ kind: 'stop' })
    await new Promise((resolve) => setImmediate(resolve))

    expect(core.shutdown).toHaveBeenCalled()
    expect(sent).toContainEqual({ kind: 'stopped' })
  })

  it('runs a tick of the core when the loop fires, and logs a tick that fails', async () => {
    const { host, core, logger, timers } = setup()
    await host.start()
    const fire = (timers.after.mock.calls[0] as unknown as [number, () => void])[1]

    fire()
    await new Promise((resolve) => setImmediate(resolve))
    expect(core.runTick).toHaveBeenCalledTimes(1)

    core.runTick.mockRejectedValueOnce(new Error('tick failed'))
    ;(timers.after.mock.calls[1] as unknown as [number, () => void])[1]()
    await new Promise((resolve) => setImmediate(resolve))
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'tick failed' }))
    await host.stop()
  })

  it('fails the waiting requests when the engine is abandoned, and ignores replies nobody waits for', async () => {
    const { engineSide, apiSide } = link()
    const port = new ChannelEnginePort(apiSide)

    const pending = port.metrics()
    port.abandon()
    await expect(pending).rejects.toMatchObject({ statusCode: 503, code: ErrorCode.SERVICE_UNAVAILABLE })

    engineSide.post({ kind: 'reply', id: 99, data: [] })
    engineSide.post({ kind: 'failure', id: 98, error: { statusCode: 500, code: 'X', message: 'late' } })
  })

  it('answers everything with "unavailable" when the engine is switched off', async () => {
    const off = new DisabledEnginePort()

    await expect(off.start()).rejects.toMatchObject({ statusCode: 503 })
    await expect(off.kill()).rejects.toMatchObject({ statusCode: 503 })
    await expect(off.list()).rejects.toMatchObject({ statusCode: 503 })
    await expect(off.act()).rejects.toMatchObject({ statusCode: 503 })
    await expect(off.linkStatus()).rejects.toMatchObject({ statusCode: 503 })
    await expect(off.metrics()).rejects.toMatchObject({ statusCode: 503 })
    expect(off.onEvent()()).toBeUndefined()
  })
})
