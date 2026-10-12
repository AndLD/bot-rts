import { ErrorCode } from '../../../../lib/utils/error-codes'
import { ok } from '../../../../lib/utils/result'
import { SCRIPT_FUNCTIONS } from '../../../../lib/utils/script-api'
import { buildBase, buildModule } from '../../../tests/integration/builders'
import { AppError } from '../../shared/domain/app-error'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { BotState } from '../domain/bot-state'
import { ScriptMisuseError } from '../domain/script-misuse'
import { CallOutcome, ScriptApi, ScriptFunctionHandler } from './script-api'

const FUNCTIONS = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled).map((spec) => spec.name)

function stateWith(...types: string[]): BotState {
  const bot = buildBase('owner')
  return {
    bot,
    ownerId: 'owner',
    modules: types.map((type) => buildModule(bot.id, { type: type as never }))
  }
}

function api(handle: ScriptFunctionHandler['handle']) {
  return new ScriptApi([{ functions: FUNCTIONS, handle }])
}

describe('ScriptApi', () => {
  it('serves a call with the handler of its function', async () => {
    const handle = jest.fn(async (): Promise<CallOutcome> => ok({ cells: 2 }))
    const state = stateWith('scanner')

    await expect(api(handle).execute(state, 'scan', [])).resolves.toEqual({ ok: true, data: { cells: 2 } })
    expect(handle).toHaveBeenCalledWith(state, 'scan', [])
  })

  it('refuses to start without a handler for every function', () => {
    expect(() => new ScriptApi([])).toThrow(/No handler for the script functions: scan/)
  })

  it('treats an unknown function as misuse', async () => {
    await expect(api(jest.fn()).execute(stateWith('scanner'), 'process', [])).rejects.toThrow(ScriptMisuseError)
  })

  it('treats a function the bot has no module for as misuse', async () => {
    const call = api(jest.fn()).execute(stateWith('drive'), 'scan', [])
    await expect(call).rejects.toThrow('scan needs a scanner module')
  })

  it('treats invalid arguments as misuse', async () => {
    await expect(api(jest.fn()).execute(stateWith('factory'), 'craft', [5])).rejects.toThrow(
      'craft: module must be a string'
    )
  })

  it('turns an error that carries a result code into a failure value', async () => {
    const call = api(async () => {
      throw new NotFoundError('No such bot')
    }).execute(stateWith('repair'), 'repair', ['a', 'b'])
    await expect(call).resolves.toEqual({ ok: false, code: 'NOT_FOUND', msg: 'No such bot' })

    const forbidden = api(async () => {
      throw new ForbiddenError('Not yours')
    }).execute(stateWith('repair'), 'repair', ['a', 'b'])
    await expect(forbidden).resolves.toMatchObject({ ok: false, code: 'FORBIDDEN' })
  })

  it.each([
    [ErrorCode.DRIVE_FULL, 'NO_SPACE'],
    [ErrorCode.DRIVE_BROKEN, 'BROKEN_MODULE'],
    [ErrorCode.NO_FREE_LOCATION, 'NO_SPACE'],
    [ErrorCode.ALREADY_EXISTS, 'BLOCKED'],
    [ErrorCode.BASE_LOST, 'FORBIDDEN']
  ])('maps the API error %s to the result code %s', async (code, expected) => {
    const call = api(async () => {
      throw new AppError(409, code, 'nope')
    }).execute(stateWith('drive'), 'read', ['/m/a'])
    await expect(call).resolves.toEqual({ ok: false, code: expected, msg: 'nope' })
  })

  it('turns a validation error of a use case into misuse and rethrows anything else', async () => {
    const invalid = api(async () => {
      throw new ValidationError('The bot has no scanner module')
    }).execute(stateWith('scanner'), 'scan', [])
    await expect(invalid).rejects.toThrow(ScriptMisuseError)

    const unknownCode = api(async () => {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'bug')
    }).execute(stateWith('scanner'), 'scan', [])
    await expect(unknownCode).rejects.toThrow('bug')

    const bug = api(async () => {
      throw new TypeError('bug')
    }).execute(stateWith('scanner'), 'scan', [])
    await expect(bug).rejects.toThrow(TypeError)
  })
})
