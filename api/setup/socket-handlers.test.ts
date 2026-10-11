import { EventEmitter } from 'events'
import { BOT_TYPE } from '../../lib/utils/interfaces/bots'
import { errors } from '../utils/constants'
import { registerBotHandlers, SocketServices } from './socket-handlers'

const userId = '64b7f0f2a1b2c3d4e5f60718'
const botId = '64b7f0f2a1b2c3d4e5f60999'

function setup() {
  const socket = Object.assign(new EventEmitter(), { user: { _id: userId } })
  const services: jest.Mocked<SocketServices> = {
    getUserBots: jest.fn(),
    getBotById: jest.fn(),
    getBotModules: jest.fn()
  }
  registerBotHandlers(socket as never, services)

  // handlers are fire-and-forget; wait for the ack
  const call = (event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack))
    })

  return { socket, services, call }
}

describe('socket bot handlers', () => {
  it('returns the bases and the bots of the user', async () => {
    const { services, call } = setup()
    services.getUserBots.mockResolvedValue([{ _id: 'b', type: BOT_TYPE.BASE }])

    expect(await call('get-user-bases')).toEqual([[{ _id: 'b', type: 'base' }]])
    expect(services.getUserBots).toHaveBeenCalledWith(userId, { type: BOT_TYPE.BASE })
    await call('get-user-bots')
    expect(services.getUserBots).toHaveBeenLastCalledWith(userId)
  })

  it('returns the modules of an own bot', async () => {
    const { services, call } = setup()
    services.getBotById.mockResolvedValue({ _id: botId, userId, type: BOT_TYPE.BASE })
    services.getBotModules.mockResolvedValue([])

    expect(await call('get-bot-modules', botId)).toEqual([[]])
  })

  it.each([undefined, null, 5, {}, 'not-an-id'])('rejects the bot id %p without touching services', async (id) => {
    const { services, call } = setup()

    expect(await call('get-bot-modules', id)).toEqual([null, errors.INVALID_ID])
    expect(services.getBotById).not.toHaveBeenCalled()
  })

  it('answers not found and forbidden', async () => {
    const { services, call } = setup()

    services.getBotById.mockResolvedValue(null)
    expect(await call('get-bot-modules', botId)).toEqual([null, errors.DOC_NOT_FOUND])
    services.getBotById.mockResolvedValue({ _id: botId, userId: 'someone-else', type: BOT_TYPE.BASE })
    expect(await call('get-bot-modules', botId)).toEqual([null, errors.FORBIDDEN])
  })

  it('turns a failing service into an error ack instead of crashing', async () => {
    const { services, call } = setup()
    services.getUserBots.mockRejectedValue(new Error('db down'))

    expect(await call('get-user-bots')).toEqual([null, errors.INTERNAL_SERVER_ERROR])
  })

  it('survives events sent without an acknowledgement callback', async () => {
    const { socket, services } = setup()
    services.getUserBots.mockRejectedValue(new Error('db down'))

    expect(() => socket.emit('get-user-bots')).not.toThrow()
    expect(() => socket.emit('get-bot-modules', 'bad')).not.toThrow()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
