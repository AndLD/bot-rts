import { Principal } from '../../auth/application/auth.service'
import { ValidationError } from '../../shared/domain/errors'
import { ScriptRunner } from '../application/script-runner'
import { ExecutionsController } from './executions.controller'

const principal = { user: { id: 'u1' } } as Principal
const execution = {
  id: 'e1',
  botId: 'b1',
  file: '/m/main.js',
  args: [],
  state: 'running',
  reason: null,
  restarts: 0
} as const

function setup() {
  const runner = {
    start: jest.fn(async () => execution),
    list: jest.fn(async () => [execution]),
    kill: jest.fn(async () => ({ ...execution, state: 'killed' as const })),
    evaluate: jest.fn()
  } as unknown as jest.Mocked<ScriptRunner>
  return { runner, controller: new ExecutionsController(runner) }
}

describe('ExecutionsController', () => {
  it('lists the scripts of the player', async () => {
    const { controller, runner } = setup()

    expect(await controller.list(principal)).toEqual([execution])
    expect(runner.list).toHaveBeenCalledWith('u1')
  })

  it('starts a script on a bot with its arguments, or none', async () => {
    const { controller, runner } = setup()

    await controller.start(principal, 'b1', { file: '/m/main.js', args: ['a', 2, true] })
    await controller.start(principal, 'b1', { file: '/m/main.js' })

    expect(runner.start).toHaveBeenNthCalledWith(1, 'u1', 'b1', '/m/main.js', ['a', 2, true])
    expect(runner.start).toHaveBeenNthCalledWith(2, 'u1', 'b1', '/m/main.js', [])
  })

  it('refuses arguments that are not strings, numbers or booleans', () => {
    const { controller, runner } = setup()

    expect(() => controller.start(principal, 'b1', { file: '/m/main.js', args: [{ a: 1 } as never] })).toThrow(
      ValidationError
    )
    expect(runner.start).not.toHaveBeenCalled()
  })

  it('stops a script of the player', async () => {
    const { controller, runner } = setup()

    expect((await controller.kill(principal, 'e1')).state).toBe('killed')
    expect(runner.kill).toHaveBeenCalledWith('u1', 'e1')
  })
})
