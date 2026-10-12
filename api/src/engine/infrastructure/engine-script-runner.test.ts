import { EngineEvent } from '../application/engine-ports'
import { EngineScriptRunner } from './engine-script-runner'

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const view = { id: 'e1', botId: 'b1', file: '/m/main.js', args: [], state: 'queued', reason: null, restarts: 0 }
  const engine = {
    start: jest.fn(async () => view as never),
    list: jest.fn(async () => [view as never]),
    kill: jest.fn(async () => view as never),
    onEvent: jest.fn((l: (event: EngineEvent) => void) => {
      listener = l
      return off
    })
  }
  return { runner: new EngineScriptRunner(engine), engine, emit: (event: EngineEvent) => listener(event), off, view }
}

describe('EngineScriptRunner', () => {
  it('starts a file, evaluates a shell line as an execution of the shell file, lists and kills', async () => {
    const { runner, engine, view } = setup()

    await expect(runner.start('u1', 'b1', '/m/main.js', [1, 'x'])).resolves.toBe(view)
    await runner.evaluate('u1', 'b1', 'bot.id')
    await runner.list('u1')
    await runner.kill('u1', 'e1')

    expect(engine.start).toHaveBeenNthCalledWith(1, { userId: 'u1', botId: 'b1', file: '/m/main.js', args: [1, 'x'] })
    expect(engine.start).toHaveBeenNthCalledWith(2, { userId: 'u1', botId: 'b1', file: '<shell>', args: ['bot.id'] })
    expect(engine.list).toHaveBeenCalledWith('u1')
    expect(engine.kill).toHaveBeenCalledWith('u1', 'e1')
  })

  it('passes on the lines scripts write and nothing else', () => {
    const { runner, emit, off } = setup()
    const heard: unknown[] = []

    const stop = runner.onOutput((output) => heard.push(output))
    emit({ type: 'log', executionId: 'e1', botId: 'b1', userId: 'u1', kind: 'output', text: 'hi' })
    emit({ type: 'radio', userId: 'u1', changes: [] })

    expect(heard).toEqual([{ type: 'log', executionId: 'e1', botId: 'b1', userId: 'u1', kind: 'output', text: 'hi' }])
    stop()
    expect(off).toHaveBeenCalled()
  })
})
