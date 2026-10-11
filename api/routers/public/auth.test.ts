import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createFakeServices } from '../../tests/fakes/services'
import { buildUser } from '../../tests/integration/builders'
import { makeApp } from '../../tests/http'
import { refreshJwtSecret } from '../../utils/jwt'
import { createAuthPublicRouter } from './auth'

function setup(overrides = {}) {
  const fake = createFakeServices()
  const user = buildUser({ email: 'alice@example.com', passwordHash: 'hashed:Passw0rd!x', ...overrides })
  fake.repositories.users.items.set(user.id, user)
  const app = makeApp((app) => {
    app.use(cookieParser())
    app.use(createAuthPublicRouter(fake.services))
  })
  return { app, user }
}

const credentials = { email: 'alice@example.com', password: 'Passw0rd!x' }
const refreshCookie = (payload: unknown, options: jwt.SignOptions = { expiresIn: '1h' }) =>
  `refreshToken=${jwt.sign(payload as object, refreshJwtSecret, options)}`

describe('POST /login', () => {
  it('issues an access token and a refresh cookie', async () => {
    const { app, user } = setup()

    const response = await request(app).post('/login').send(credentials).expect(200)

    expect(jwt.decode(response.body.result)).toMatchObject({ user: { _id: user.id, status: 'user' } })
    expect(response.headers['set-cookie'][0]).toContain('refreshToken=')
  })

  it('rejects wrong credentials, banned and unverified users', async () => {
    await request(setup().app)
      .post('/login')
      .send({ ...credentials, password: 'Wr0ng!pass' })
      .expect(401)
    await request(setup().app)
      .post('/login')
      .send({ ...credentials, email: 'nobody@example.com' })
      .expect(401)
    await request(setup({ status: 'banned' }).app)
      .post('/login')
      .send(credentials)
      .expect(403)
    await request(setup({ isActive: false }).app)
      .post('/login')
      .send(credentials)
      .expect(403)
  })

  it('validates the body', async () => {
    await request(setup().app).post('/login').send({ email: 'nope' }).expect(400)
  })
})

describe('GET /refresh', () => {
  it('needs a valid refresh cookie with a well-formed payload', async () => {
    const { app, user } = setup()

    await request(app).get('/refresh').expect(401)
    await request(app).get('/refresh').set('Cookie', 'refreshToken=garbage').expect(401)
    await request(app)
      .get('/refresh')
      .set('Cookie', refreshCookie({ user: null }))
      .expect(401)
    await request(app)
      .get('/refresh')
      .set('Cookie', refreshCookie({ user: { _id: user.id } }, { expiresIn: -10 }))
      .expect(401)
  })

  it('issues a new access token with the current state of the user', async () => {
    const { app, user } = setup({ status: 'admin' })

    const response = await request(app)
      .get('/refresh')
      .set('Cookie', refreshCookie({ user: { _id: user.id } }))
      .expect(200)

    expect(jwt.decode(response.body.result)).toMatchObject({ user: { status: 'admin' } })
  })

  it('rejects deleted, banned and unverified users', async () => {
    const missing = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'

    await request(setup().app)
      .get('/refresh')
      .set('Cookie', refreshCookie({ user: { _id: missing } }))
      .expect(401)
    for (const overrides of [{ status: 'banned' }, { isActive: false }]) {
      const { app, user } = setup(overrides)
      await request(app)
        .get('/refresh')
        .set('Cookie', refreshCookie({ user: { _id: user.id } }))
        .expect(403)
    }
  })
})

describe('POST /logout', () => {
  it('clears the cookie', async () => {
    const response = await request(setup().app).post('/logout').expect(200)

    expect(response.headers['set-cookie'][0]).toContain('refreshToken=;')
  })
})
