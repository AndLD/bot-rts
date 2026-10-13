import { PRIVACY_POLICY_VERSION } from '../../../../lib/utils/privacy'
import { Socket } from 'socket.io'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../../../lib/utils/constants'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { Logger } from '../../shared/application/logger'
import { createSocketAuthMiddleware } from './socket-auth.middleware'

const input = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'Passw0rd!x',
  acceptedPrivacyVersion: PRIVACY_POLICY_VERSION
}

async function setup(verifyEmail = true) {
  const world = createAuthWorld()
  const { accessToken } = await world.auth.register(input)
  if (verifyEmail) {
    await world.auth.verifyEmail(world.mailer.last('verification')!.token)
  }
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return { ...world, accessToken, logger, middleware: createSocketAuthMiddleware(world.authService, logger) }
}

const makeSocket = (token?: unknown, via: 'auth' | 'query' = 'auth') =>
  ({ handshake: via === 'auth' ? { auth: { token }, query: {} } : { auth: {}, query: { token } } }) as unknown as Socket

describe('socket handshake authentication', () => {
  it('attaches the principal for a valid token, from the auth object or the query', async () => {
    const { middleware, accessToken, repositories } = await setup()
    const [user] = repositories.users.items.values()

    for (const via of ['auth', 'query'] as const) {
      const socket = makeSocket(accessToken, via)
      const next = jest.fn()

      await middleware(socket, next)

      expect(next).toHaveBeenCalledWith()
      expect(socket.principal?.user.id).toBe(user.id)
    }
  })

  it('rejects a missing or non-string token', async () => {
    const { middleware } = await setup()

    for (const token of [undefined, '', 5, ['a']]) {
      const next = jest.fn()

      await middleware(makeSocket(token), next)

      expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    }
  })

  it('tells an expired token from an invalid one', async () => {
    const { middleware, accessToken, accessTokens, logger } = await setup()
    accessTokens.expired.add(accessToken)
    const [expired, invalid] = [jest.fn(), jest.fn()]

    await middleware(makeSocket(accessToken), expired)
    await middleware(makeSocket('garbage'), invalid)

    expect(expired.mock.calls[0][0].message).toBe(SOCKET_TOKEN_EXPIRED)
    expect(invalid.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('rejects banned and unverified users', async () => {
    const banned = await setup()
    const [user] = banned.repositories.users.items.values()
    banned.repositories.users.items.set(user.id, { ...user, status: 'banned' })
    const unverified = await setup(false)
    const [first, second] = [jest.fn(), jest.fn()]

    await banned.middleware(makeSocket(banned.accessToken), first)
    await unverified.middleware(makeSocket(unverified.accessToken), second)

    expect(first.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    expect(second.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
  })
})
