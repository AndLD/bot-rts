import { EventEmitter } from 'events'
import { BOT_TYPE } from '../../lib/utils/interfaces/bots'
import { createFakeServices } from '../tests/fakes/services'
import { SocketBotsService, registerBotHandlers } from './socket-handlers'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const missing = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'

function setup(bots?: SocketBotsService, userId = alice.id) {
  const fake = createFakeServices()
  const socket = Object.assign(new EventEmitter(), { user: { _id: userId } })
  registerBotHandlers(socket as never, bots ?? fake.services.bots)

  // handlers are fire-and-forget; wait for the acknowledgement
  const call = (event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack))
    })

  return { ...fake, socket, call }
}

describe('socket bot handlers', () => {
  it('returns the bases and the bots of the user as DTOs', async () => {
    const { services, call } = setup()
    const { bot } = await services.bots.deployUserBase(alice)

    const expected = [[expect.objectContaining({ _id: bot.id, type: 'base', userId: alice.id })]]
    expect(await call('get-user-bases')).toEqual(expected)
    expect(await call('get-user-bots')).toEqual(expected)
  })

  it('returns the modules of an own bot', async () => {
    const { services, call } = setup()
    const { bot } = await services.bots.deployUserBase(alice)

    const [modules] = await call('get-bot-modules', bot.id)

    expect(modules).toHaveLength(7)
    expect(modules).toContainEqual(expect.objectContaining({ type: 'scanner', distance: 1 }))
  })

  it.each([undefined, null, 5, {}, 'not-an-id'])('rejects the bot id %p without touching services', async (id) => {
    const bots = { listUserBots: jest.fn(), getBotModules: jest.fn() }
    const { call } = setup(bots)

    expect(await call('get-bot-modules', id)).toEqual([null, { code: 400, msg: 'Invalid id' }])
    expect(bots.getBotModules).not.toHaveBeenCalled()
  })

  it('answers not found and forbidden', async () => {
    const { services, call } = setup(undefined, '22222222-2222-4222-8222-222222222222')
    const { bot } = await services.bots.deployUserBase(alice)

    expect(await call('get-bot-modules', missing)).toEqual([null, { code: 404, msg: 'Bot not found' }])
    expect((await call('get-bot-modules', bot.id))[1]).toMatchObject({ code: 403 })
  })

  it('turns a failing service into an error acknowledgement instead of crashing', async () => {
    const bots = { listUserBots: jest.fn().mockRejectedValue(new Error('db down')), getBotModules: jest.fn() }
    const { call } = setup(bots)

    expect(await call('get-user-bots')).toEqual([null, { code: 500, msg: 'INTERNAL_ERROR' }])
    expect(BOT_TYPE.BASE).toBe('base')
  })

  it('survives events sent without an acknowledgement callback', async () => {
    const bots = { listUserBots: jest.fn().mockRejectedValue(new Error('db down')), getBotModules: jest.fn() }
    const { socket } = setup(bots)

    expect(() => socket.emit('get-user-bots')).not.toThrow()
    expect(() => socket.emit('get-bot-modules', 'bad')).not.toThrow()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
