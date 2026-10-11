import bcrypt from 'bcrypt'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { usersCollection } from '../../services/db'
import { usersService } from '../../services/users'
import { createJwt, refreshJwtSecret } from '../../utils/jwt'
import { makeApp, makeUser } from '../../tests/helpers'
import authPublicRouter from '../../routers/public/auth'
import { toUserState } from '../../utils/userAccess'

jest.mock('../../services/db', () => ({ usersCollection: { findOne: jest.fn() } }))
jest.mock('../../services/users', () => ({ usersService: { findUserById: jest.fn() } }))

const findOne = usersCollection.findOne as jest.Mock
const findUserById = usersService.findUserById as jest.Mock

const app = makeApp((app) => {
  app.use(cookieParser())
  app.use(authPublicRouter)
})

const credentials = { email: 'alice@example.com', password: 'Passw0rd!x' }

beforeEach(() => jest.resetAllMocks())

describe('POST /login', () => {
  const user = () => makeUser({ password: bcrypt.hashSync(credentials.password, 4) })

  it('issues tokens for valid credentials', async () => {
    findOne.mockResolvedValue(user())

    const response = await request(app).post('/login').send(credentials).expect(200)

    expect(response.body.result).toEqual(expect.any(String))
    expect(response.headers['set-cookie'][0]).toContain('refreshToken=')
  })

  it('rejects unknown users and wrong passwords', async () => {
    findOne.mockResolvedValue(null)
    await request(app).post('/login').send(credentials).expect(401)
    findOne.mockResolvedValue(user())
    await request(app)
      .post('/login')
      .send({ ...credentials, password: 'Wr0ng!pass' })
      .expect(401)
  })

  it('rejects banned and unverified users', async () => {
    findOne.mockResolvedValue({ ...user(), status: 'banned' })
    await request(app).post('/login').send(credentials).expect(403)
    findOne.mockResolvedValue({ ...user(), active: false })
    await request(app).post('/login').send(credentials).expect(403)
  })
})

describe('GET /refresh', () => {
  const refreshCookie = (payload: unknown = { user: { _id: '64b7f0f2a1b2c3d4e5f60718' } }) =>
    `refreshToken=${jwt.sign(payload as object, refreshJwtSecret, { expiresIn: '1h' })}`

  it('needs the cookie', async () => {
    await request(app).get('/refresh').expect(401)
  })

  it('rejects an invalid token and a bad payload', async () => {
    await request(app).get('/refresh').set('Cookie', 'refreshToken=garbage').expect(401)
    await request(app)
      .get('/refresh')
      .set('Cookie', refreshCookie({ user: null }))
      .expect(401)
    await request(app).get('/refresh').set('Cookie', refreshCookie({})).expect(401)
  })

  it('issues a new access token with the current user state', async () => {
    findUserById.mockResolvedValue(makeUser({ status: 'admin' }))

    const response = await request(app).get('/refresh').set('Cookie', refreshCookie()).expect(200)
    const decoded = jwt.decode(response.body.result) as { user: { status: string } }

    expect(decoded.user.status).toBe('admin')
  })

  it('rejects deleted, banned and unverified users', async () => {
    findUserById.mockResolvedValue(null)
    await request(app).get('/refresh').set('Cookie', refreshCookie()).expect(401)
    findUserById.mockResolvedValue(makeUser({ status: 'banned' }))
    await request(app).get('/refresh').set('Cookie', refreshCookie()).expect(403)
    findUserById.mockResolvedValue(makeUser({ active: false }))
    await request(app).get('/refresh').set('Cookie', refreshCookie()).expect(403)
  })
})

describe('POST /logout', () => {
  it('clears the cookie', async () => {
    const response = await request(app).post('/logout').expect(200)

    expect(response.headers['set-cookie'][0]).toContain('refreshToken=;')
  })
})

it('createJwt signs both tokens', () => {
  const tokens = createJwt(toUserState(makeUser()))

  expect(Object.keys(tokens)).toEqual(['accessToken', 'refreshToken'])
})
