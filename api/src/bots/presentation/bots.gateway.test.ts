import { EventEmitter } from 'events'
import { Server, Socket } from 'socket.io'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { buildUser } from '../../../tests/integration/builders'
import { Logger } from '../../shared/application/logger'
import { BotsGateway } from './bots.gateway'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const missing = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'

function setup(userId = alice.id) {
  const world = createAuthWorld()
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const gateway = new BotsGateway(world.botsService, world.authService, logger)
  const socket = Object.assign(new EventEmitter(), { principal: { user: buildUser({ id: userId }) } })
  gateway.handleConnection(socket as unknown as Socket)

  // handlers are fire-and-forget; wait for the acknowledgement
  const call = (event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack))
    })

  return { ...world, gateway, logger, socket, call }
}

describe('BotsGateway', () => {
  it('installs the handshake authentication on the server', () => {
    const { gateway } = setup()
    const server = { use: jest.fn() }

    gateway.afterInit(server as unknown as Server)

    expect(server.use).toHaveBeenCalledWith(expect.any(Function))
  })

  it('returns the bases and the bots of the player as DTOs', async () => {
    const { botsService, call } = setup()
    const { bot } = await botsService.deployUserBase(alice)

    const expected = [[expect.objectContaining({ _id: bot.id, type: 'base', userId: alice.id })]]
    expect(await call('get-user-bases')).toEqual(expected)
    expect(await call('get-user-bots')).toEqual(expected)
  })

  it('returns the modules of an own bot', async () => {
    const { botsService, call } = setup()
    const { bot } = await botsService.deployUserBase(alice)

    const [modules] = await call('get-bot-modules', bot.id)

    expect(modules).toHaveLength(7)
    expect(modules).toContainEqual(expect.objectContaining({ type: 'scanner', distance: 1 }))
  })

  it.each([undefined, null, 5, {}, 'not-an-id'])('rejects the bot id %p', async (id) => {
    const { call } = setup()

    expect(await call('get-bot-modules', id)).toEqual([null, { code: 400, msg: 'Invalid id' }])
  })

  it('answers not found and forbidden', async () => {
    const { botsService, call } = setup('22222222-2222-4222-8222-222222222222')
    const { bot } = await botsService.deployUserBase(alice)

    expect(await call('get-bot-modules', missing)).toEqual([null, { code: 404, msg: 'Bot not found' }])
    expect((await call('get-bot-modules', bot.id))[1]).toMatchObject({ code: 403 })
  })

  it('turns a failing use case into an error acknowledgement and logs it', async () => {
    const { botsService, call, logger } = setup()
    jest.spyOn(botsService, 'listUserBots').mockRejectedValue(new Error('db down'))

    expect(await call('get-user-bots')).toEqual([null, { code: 500, msg: 'INTERNAL_ERROR' }])
    expect(logger.error).toHaveBeenCalled()
  })

  it('survives events sent without an acknowledgement callback', async () => {
    const { botsService, socket } = setup()
    jest.spyOn(botsService, 'listUserBots').mockRejectedValue(new Error('db down'))

    expect(() => socket.emit('get-user-bots')).not.toThrow()
    expect(() => socket.emit('get-bot-modules', 'bad')).not.toThrow()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
