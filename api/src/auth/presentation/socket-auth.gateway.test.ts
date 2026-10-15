import { Server, Socket } from 'socket.io'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { RateLimiter } from '../../ratelimit/application/rate-limiter'
import { Logger } from '../../shared/application/logger'
import { SocketAuthGateway } from './socket-auth.gateway'

const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
const limiter = { consume: jest.fn() } as unknown as RateLimiter

function install(authenticate: (token: string) => Promise<unknown>) {
  const gateway = new SocketAuthGateway({ authenticate } as never, logger, limiter, {} as never)
  let middleware: ((socket: Socket, next: (error?: Error) => void) => Promise<void>) | undefined
  gateway.afterInit({ use: (fn: typeof middleware) => (middleware = fn) } as unknown as Server)
  return middleware as NonNullable<typeof middleware>
}

const handshake = { handshake: { auth: { token: 't' }, query: {} } }

describe('SocketAuthGateway', () => {
  it('installs the handshake authentication on the server', () => {
    const gateway = new SocketAuthGateway(createAuthWorld().authService, logger, limiter, {} as never)
    const server = { use: jest.fn() }

    gateway.afterInit(server as unknown as Server)

    expect(server.use).toHaveBeenCalledWith(expect.any(Function))
  })

  it('lets a session connect without guarding its events', async () => {
    const middleware = install(async () => ({ user: { id: 'u' } }))
    const socket = { ...handshake, use: jest.fn() } as unknown as Socket
    const next = jest.fn()

    await middleware(socket, next)

    expect(next).toHaveBeenCalledWith(undefined)
    expect(socket.use).not.toHaveBeenCalled()
  })

  it('holds the connection of an API key to its scopes', async () => {
    const middleware = install(async () => ({
      user: { id: 'u' },
      apiKey: { id: 'k', scopes: ['read'], ratePerMinute: 5 }
    }))
    const socket = { ...handshake, use: jest.fn() } as unknown as Socket
    const next = jest.fn()

    await middleware(socket, next)

    expect(next).toHaveBeenCalledWith(undefined)
    expect(socket.use).toHaveBeenCalledTimes(1)
  })

  it('refuses the connection when the token is not valid, guarding nothing', async () => {
    const middleware = install(async () => {
      throw new Error('bad')
    })
    const socket = { ...handshake, use: jest.fn() } as unknown as Socket
    const next = jest.fn()

    await middleware(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect(socket.use).not.toHaveBeenCalled()
  })
})
