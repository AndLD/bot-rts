import request from 'supertest'
import { SOCKET_TOKEN_EXPIRED, SOCKET_UNAUTHORIZED } from '../../lib/utils/constants'
import { makeApp, makeUser, signAccessToken } from '../tests/helpers'
import { createIsAuthorized, createIsSocketAuthorized } from './authorization'

const userId = '64b7f0f2a1b2c3d4e5f60718'

function setup(user = makeUser()) {
  const findUserById = jest.fn().mockResolvedValue(user)
  const app = makeApp((app) => {
    app.get('/private', createIsAuthorized({ findUserById }), (req: any, res) => res.json(req.user))
  })

  return { app, findUserById }
}

describe('isAuthorized', () => {
  it('rejects a request without the header', async () => {
    const { app } = setup()

    await request(app).get('/private').expect(401)
  })

  it('rejects a malformed or foreign token', async () => {
    const { app } = setup()

    await request(app).get('/private').set('Authorization', 'Bearer nope').expect(401)
    await request(app).get('/private').set('Authorization', 'Bearer').expect(401)
  })

  it('rejects a token whose payload has the wrong shape', async () => {
    const { app, findUserById } = setup()
    const token = signAccessToken({ user: { _id: { $ne: null } } })

    await request(app).get('/private').set('Authorization', `Bearer ${token}`).expect(401)
    expect(findUserById).not.toHaveBeenCalled()
  })

  it('rejects an expired token', async () => {
    const { app } = setup()
    const token = signAccessToken({ user: { _id: userId } }, { expiresIn: -10 })

    await request(app).get('/private').set('Authorization', `Bearer ${token}`).expect(401)
  })

  it('rejects a token of a deleted user', async () => {
    const { app, findUserById } = setup()
    findUserById.mockResolvedValue(null)

    await request(app)
      .get('/private')
      .set('Authorization', `Bearer ${signAccessToken({ user: { _id: userId } })}`)
      .expect(401)
  })

  it('rejects banned and unverified users even with a valid token', async () => {
    const token = signAccessToken({ user: { _id: userId } })

    await request(setup(makeUser({ status: 'banned' })).app)
      .get('/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
    await request(setup(makeUser({ active: false })).app)
      .get('/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  it('takes the current role from the database, not from the token', async () => {
    const { app } = setup(makeUser({ status: 'user' }))
    const token = signAccessToken({ user: { _id: userId, status: 'owner' } })

    const response = await request(app).get('/private').set('Authorization', `Bearer ${token}`).expect(200)

    expect(response.body.status).toBe('user')
    expect(response.body.password).toBeUndefined()
  })
})

describe('isSocketAuthorized', () => {
  const makeSocket = (token?: unknown, via: 'auth' | 'query' = 'auth') =>
    ({
      handshake: via === 'auth' ? { auth: { token }, query: {} } : { auth: {}, query: { token } }
    }) as never

  const run = async (socket: never, user = makeUser()) => {
    const next = jest.fn()
    await createIsSocketAuthorized({ findUserById: jest.fn().mockResolvedValue(user) })(socket, next)
    return next
  }

  it('attaches the user for a valid token', async () => {
    const socket = makeSocket(signAccessToken({ user: { _id: userId } }))
    const next = await run(socket)

    expect(next).toHaveBeenCalledWith()
    expect((socket as { user?: { status: string } }).user?.status).toBe('user')
  })

  it('reads the token from the query too', async () => {
    const next = await run(makeSocket(signAccessToken({ user: { _id: userId } }), 'query'))

    expect(next).toHaveBeenCalledWith()
  })

  it('rejects a missing or non-string token', async () => {
    for (const token of [undefined, '', 5, ['a']]) {
      const next = await run(makeSocket(token))

      expect(next.mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    }
  })

  it('rejects an expired token with a distinct message', async () => {
    const next = await run(makeSocket(signAccessToken({ user: { _id: userId } }, { expiresIn: -10 })))

    expect(next.mock.calls[0][0].message).toBe(SOCKET_TOKEN_EXPIRED)
  })

  it('rejects an invalid token, a bad payload and a banned user', async () => {
    expect((await run(makeSocket('garbage'))).mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    expect((await run(makeSocket(signAccessToken({ user: {} })))).mock.calls[0][0].message).toBe(SOCKET_UNAUTHORIZED)
    expect(
      (await run(makeSocket(signAccessToken({ user: { _id: userId } })), makeUser({ status: 'banned' }))).mock
        .calls[0][0].message
    ).toBe(SOCKET_UNAUTHORIZED)
  })
})
