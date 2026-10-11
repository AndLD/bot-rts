import request from 'supertest'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { createAuthWorld } from '../tests/fakes/auth'
import { makeApp } from '../tests/http'
import { AuthorizedRequest, createIsAuthorized, createIsSocketAuthorized } from './authorization'

const input = { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!x' }

async function setup(verifyEmail = true) {
  const world = createAuthWorld()
  const { accessToken } = await world.auth.register(input)
  if (verifyEmail) {
    await world.auth.verifyEmail(world.mailer.last('verification')!.token)
  }
  const app = makeApp((app) => {
    app.get('/private', createIsAuthorized(world.authService), (req, res) => res.json((req as AuthorizedRequest).user))
  })
  return { ...world, app, accessToken }
}

describe('isAuthorized', () => {
  it('rejects a request without a bearer token', async () => {
    const { app } = await setup()

    await request(app).get('/private').expect(401)
    await request(app).get('/private').set('Authorization', 'Basic abc').expect(401)
    await request(app).get('/private').set('Authorization', 'Bearer').expect(401)
  })

  it('rejects a malformed or expired token', async () => {
    const { app, accessToken, accessTokens } = await setup()
    accessTokens.expired.add(accessToken)

    await request(app).get('/private').set('Authorization', 'Bearer nope').expect(401)
    const expired = await request(app).get('/private').set('Authorization', `Bearer ${accessToken}`).expect(401)
    expect(expired.body.code).toBe('TOKEN_EXPIRED')
  })

  it('rejects unverified and banned users', async () => {
    const unverified = await setup(false)
    await request(unverified.app).get('/private').set('Authorization', `Bearer ${unverified.accessToken}`).expect(403)

    const banned = await setup()
    const [user] = banned.repositories.users.items.values()
    banned.repositories.users.items.set(user.id, { ...user, status: 'banned' })
    await request(banned.app).get('/private').set('Authorization', `Bearer ${banned.accessToken}`).expect(403)
  })

  it('exposes the current state of the user, never the token claims or secrets', async () => {
    const { app, accessToken, repositories } = await setup()
    const [user] = repositories.users.items.values()
    repositories.users.items.set(user.id, { ...user, status: 'admin' })

    const response = await request(app).get('/private').set('Authorization', `Bearer ${accessToken}`).expect(200)

    expect(response.body).toMatchObject({ _id: user.id, status: 'admin', active: true })
    expect(JSON.stringify(response.body)).not.toContain('hash')
  })
})

describe('isSocketAuthorized', () => {
  const makeSocket = (token?: unknown, via: 'auth' | 'query' = 'auth') =>
    ({ handshake: via === 'auth' ? { auth: { token }, query: {} } : { auth: {}, query: { token } } }) as never

  it('attaches the user for a valid token, from the auth object or the query', async () => {
    const { authService, accessToken } = await setup()
    for (const via of ['auth', 'query'] as const) {
      const socket = makeSocket(accessToken, via)
      const next = jest.fn()

      await createIsSocketAuthorized(authService)(socket, next)

      expect(next).toHaveBeenCalledWith()
      expect((socket as { user?: { status: string } }).user?.status).toBe('user')
    }
  })

  it('rejects a missing or non-string token', async () => {
    const { authService } = await setup()
    for (const token of [undefined, '', 5, ['a']]) {
      const next = jest.fn()

      await createIsSocketAuthorized(authService)(makeSocket(token), next)

      expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    }
  })

  it('tells an expired token from an invalid one', async () => {
    const { authService, accessToken, accessTokens } = await setup()
    accessTokens.expired.add(accessToken)
    const [expired, invalid] = [jest.fn(), jest.fn()]

    await createIsSocketAuthorized(authService)(makeSocket(accessToken), expired)
    await createIsSocketAuthorized(authService)(makeSocket('garbage'), invalid)

    expect(expired.mock.calls[0][0].message).toBe(SOCKET_TOKEN_EXPIRED)
    expect(invalid.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
  })

  it('rejects banned users', async () => {
    const { authService, accessToken, repositories } = await setup()
    const [user] = repositories.users.items.values()
    repositories.users.items.set(user.id, { ...user, status: 'banned' })
    const next = jest.fn()

    await createIsSocketAuthorized(authService)(makeSocket(accessToken), next)

    expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
  })
})
