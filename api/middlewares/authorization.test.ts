import request from 'supertest'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { FakeClock, FakeHasher, InMemoryUserRepository, SequentialIdGenerator } from '../tests/fakes/fakes'
import { buildUser } from '../tests/integration/builders'
import { makeApp, signAccessToken } from '../tests/http'
import { UsersService } from '../src/users/application/users.service'
import { AuthorizedRequest, createIsAuthorized, createIsSocketAuthorized } from './authorization'

function setup(overrides = {}) {
  const repository = new InMemoryUserRepository()
  const user = buildUser(overrides)
  repository.items.set(user.id, user)
  const users = new UsersService(repository, new FakeHasher(), new SequentialIdGenerator(), new FakeClock())
  const app = makeApp((app) => {
    app.get('/private', createIsAuthorized(users), (req, res) => res.json((req as AuthorizedRequest).user))
  })
  return { app, user, users }
}

describe('isAuthorized', () => {
  it('rejects a request without the header', async () => {
    await request(setup().app).get('/private').expect(401)
  })

  it('rejects a malformed token', async () => {
    const { app } = setup()

    await request(app).get('/private').set('Authorization', 'Bearer nope').expect(401)
    await request(app).get('/private').set('Authorization', 'Bearer').expect(401)
  })

  it('rejects a token whose payload has the wrong shape', async () => {
    const { app } = setup()
    const token = signAccessToken({ user: { _id: { $ne: null } } })

    await request(app).get('/private').set('Authorization', `Bearer ${token}`).expect(401)
  })

  it('rejects an expired token and the token of a deleted user', async () => {
    const { app, user } = setup()

    await request(app)
      .get('/private')
      .set('Authorization', `Bearer ${signAccessToken({ user: { _id: user.id } }, { expiresIn: -10 })}`)
      .expect(401)
    await request(app)
      .get('/private')
      .set('Authorization', `Bearer ${signAccessToken({ user: { _id: '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e' } })}`)
      .expect(401)
  })

  it('rejects banned and unverified users even with a valid token', async () => {
    for (const overrides of [{ status: 'banned' }, { isActive: false }]) {
      const { app, user } = setup(overrides)

      await request(app)
        .get('/private')
        .set('Authorization', `Bearer ${signAccessToken({ user: { _id: user.id } })}`)
        .expect(403)
    }
  })

  it('takes the current role from the store, not from the token', async () => {
    const { app, user } = setup({ status: 'user' })
    const token = signAccessToken({ user: { _id: user.id, status: 'owner' } })

    const response = await request(app).get('/private').set('Authorization', `Bearer ${token}`).expect(200)

    expect(response.body.status).toBe('user')
    expect(JSON.stringify(response.body)).not.toContain('hash')
  })
})

describe('isSocketAuthorized', () => {
  const makeSocket = (token?: unknown, via: 'auth' | 'query' = 'auth') =>
    ({ handshake: via === 'auth' ? { auth: { token }, query: {} } : { auth: {}, query: { token } } }) as never

  const run = async (socket: never, overrides = {}) => {
    const { users, user } = setup(overrides)
    const next = jest.fn()
    await createIsSocketAuthorized(users)(socket, next)
    return { next, user }
  }

  const tokenFor = (id: string, options = {}) => signAccessToken({ user: { _id: id } }, options)

  it('attaches the user for a valid token, from the auth object or the query', async () => {
    const { users, user } = setup()
    for (const via of ['auth', 'query'] as const) {
      const socket = makeSocket(tokenFor(user.id), via)
      const next = jest.fn()

      await createIsSocketAuthorized(users)(socket, next)

      expect(next).toHaveBeenCalledWith()
      expect((socket as { user?: { status: string } }).user?.status).toBe('user')
    }
  })

  it('rejects a missing or non-string token', async () => {
    for (const token of [undefined, '', 5, ['a']]) {
      const { next } = await run(makeSocket(token))

      expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    }
  })

  it('rejects an expired token with a distinct message', async () => {
    const { users, user } = setup()
    const next = jest.fn()

    await createIsSocketAuthorized(users)(makeSocket(tokenFor(user.id, { expiresIn: -10 })), next)

    expect(next.mock.calls[0][0].message).toBe(SOCKET_TOKEN_EXPIRED)
  })

  it('rejects an invalid token, a bad payload and a banned user', async () => {
    expect((await run(makeSocket('garbage'))).next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    expect((await run(makeSocket(signAccessToken({ user: {} })))).next.mock.calls[0][0].message).toBe(
      SOCKET_UNAUTHORIZED
    )

    const { users, user } = setup({ status: 'banned' })
    const next = jest.fn()
    await createIsSocketAuthorized(users)(makeSocket(tokenFor(user.id)), next)
    expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
  })
})
