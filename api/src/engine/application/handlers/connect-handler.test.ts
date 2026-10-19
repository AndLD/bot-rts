import { ok } from '../../../../../lib/utils/result'
import { SCRIPT_FUNCTIONS } from '../../../../../lib/utils/script-api'
import { buildBase } from '../../../../tests/integration/builders'
import { BotLockedError, BotPasswordWrongError } from '../../../terminal/domain/terminal.errors'
import { BotState } from '../../domain/bot-state'
import { ScriptApi } from '../script-api'
import { ConnectHandler } from './connect-handler'

const bot = buildBase('owner-1')
const state: BotState = { bot, ownerId: 'owner-1', modules: [] }

function setup(connect: jest.Mock) {
  const outbox = { publish: jest.fn(), now: () => 1234 }
  return { outbox, handler: new ConnectHandler({ connect } as never, outbox as never) }
}

describe('ConnectHandler', () => {
  it('connects the bot of the script to the target with the password and tells which bot it reached', async () => {
    const connect = jest.fn(async () => ({ bot: { id: 'target' }, isForeign: true }))
    const { handler, outbox } = setup(connect)

    expect(await handler.handle(state, 'connect', ['target', 'secret1'])).toEqual(
      ok({ botId: 'target', isForeign: true })
    )
    expect(connect).toHaveBeenCalledWith('owner-1', bot.id, 'target', 'secret1')
    expect(outbox.publish).not.toHaveBeenCalled()
  })

  it('needs no password for a bot of the player', async () => {
    const connect = jest.fn(async () => ({ bot: { id: 'mine' }, isForeign: false }))

    expect(await setup(connect).handler.handle(state, 'connect', ['mine'])).toEqual(
      ok({ botId: 'mine', isForeign: false })
    )
    expect(connect).toHaveBeenCalledWith('owner-1', bot.id, 'mine', undefined)
  })

  it('tells the owner of the target about a wrong password, and lets the error through', async () => {
    const attempt = { targetBotId: 'target', ownerId: 'owner-2', isLockedOut: true }
    const connect = jest.fn(async () => {
      throw new BotPasswordWrongError(attempt)
    })
    const { handler, outbox } = setup(connect)

    await expect(handler.handle(state, 'connect', ['target', 'nope'])).rejects.toBeInstanceOf(BotPasswordWrongError)
    expect(outbox.publish).toHaveBeenCalledWith({
      type: 'PasswordAttemptFailed',
      at: 1234,
      parties: [
        { userId: 'owner-2', botId: 'target' },
        { userId: 'owner-1', botId: bot.id }
      ],
      isLockedOut: true
    })
  })

  it('tells nobody when the attempt failed for another reason', async () => {
    const connect = jest.fn(async () => {
      throw new BotLockedError()
    })
    const { handler, outbox } = setup(connect)

    await expect(handler.handle(state, 'connect', ['target', 'x'])).rejects.toBeInstanceOf(BotLockedError)
    expect(outbox.publish).not.toHaveBeenCalled()
  })
})

describe('connect in the script API', () => {
  const adapterBot: BotState = {
    ...state,
    modules: [{ type: 'wirelessAdapter' } as never]
  }
  const others = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled && spec.name !== 'connect').map(
    (spec) => spec.name
  )
  const apiWith = (connect: jest.Mock) =>
    new ScriptApi([setup(connect).handler, { functions: others, handle: jest.fn() }])

  it('is a failed result, not a thrown error, when the password is wrong or the bot is locked out', async () => {
    const wrong = jest.fn(async () => {
      throw new BotPasswordWrongError({ targetBotId: 't', ownerId: null as never, isLockedOut: false })
    })
    const locked = jest.fn(async () => {
      throw new BotLockedError()
    })

    expect(await apiWith(wrong).execute(adapterBot, 'connect', ['t', 'x'])).toMatchObject({
      ok: false,
      code: 'FORBIDDEN'
    })
    expect(await apiWith(locked).execute(adapterBot, 'connect', ['t', 'x'])).toMatchObject({
      ok: false,
      code: 'FORBIDDEN'
    })
  })

  it('takes a string password at most, and a bot id', async () => {
    const api = apiWith(jest.fn())

    await expect(api.execute(adapterBot, 'connect', [])).rejects.toThrow('botId is required')
    await expect(api.execute(adapterBot, 'connect', ['t', 5 as never])).rejects.toThrow('password must be a string')
    await expect(api.execute(state, 'connect', ['t'])).rejects.toThrow('needs a wirelessAdapter module')
  })
})
