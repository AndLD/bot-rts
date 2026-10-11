import http from 'http'
import { AddressInfo } from 'net'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { urlForDatabase } from '../tests/integration/database-url'
import { buildUser } from '../tests/integration/builders'
import { AppServices } from '../src/composition'

// Safety-net tests: the golden flows of the whole stack (HTTP and Socket.IO → use cases → PostgreSQL)

let database: TestDatabase
let services: AppServices
let server: http.Server
let url: string
let createEmailVerificationJwt: (userId: string) => string
let signAccessToken: (payload: unknown, options?: jwt.SignOptions) => string

const password = 'Passw0rd!x'

beforeAll(async () => {
  database = await createTestDatabase()
  const databaseName = (await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0].db

  // The modules read their configuration when they are loaded, so the environment is prepared first
  Object.assign(process.env, { DATABASE_URL: urlForDatabase(databaseName), RATE_LIMIT_AUTH_MAX: '1000' })
  jest.isolateModules(() => {
    const { createServices } = require('../src/composition')
    const { setupServer } = require('./server')
    const jwtUtils = require('../utils/jwt')
    services = createServices(process.env, 'http://localhost:5173')
    server = setupServer(services)
    createEmailVerificationJwt = jwtUtils.createEmailVerificationJwt
    signAccessToken = (payload, options) =>
      jwt.sign(payload as object, jwtUtils.accessJwtSecret, { expiresIn: '5m', ...options })
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  url = `http://localhost:${(server.address() as AddressInfo).port}`
})
beforeEach(() => database.reset())
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await services.close()
  await database.drop()
})

async function signUp(email: string, name = 'Alice') {
  const response = await request(url).post('/api/public/users').send({ email, name, password }).expect(200)
  const user = await database.client.user.findUniqueOrThrow({ where: { email } })
  return { user, accessToken: response.body.result as string }
}

async function signUpVerifiedAndLogIn(email: string, name = 'Alice') {
  const { user } = await signUp(email, name)
  await request(url)
    .get(`/api/public/users/verify?token=${createEmailVerificationJwt(user.id)}`)
    .expect(200)
  const login = await request(url).post('/api/public/auth/login').send({ email, password }).expect(200)
  return { user, accessToken: login.body.result as string, cookie: login.headers['set-cookie'] as unknown as string[] }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('account flows', () => {
  it('signs up, verifies the email, logs in, refreshes and logs out', async () => {
    const { user } = await signUp('alice@example.com')
    expect(user).toMatchObject({ status: 'user', isActive: false })

    await request(url)
      .get(`/api/public/users/verify?token=${createEmailVerificationJwt(user.id)}`)
      .expect(200)
    expect(await database.client.user.findUnique({ where: { id: user.id } })).toMatchObject({ isActive: true })

    const login = await request(url)
      .post('/api/public/auth/login')
      .send({ email: 'alice@example.com', password })
      .expect(200)
    await request(url).get('/api/private/auth/verify').set(bearer(login.body.result)).expect(200)

    const refreshed = await request(url)
      .get('/api/public/auth/refresh')
      .set('Cookie', login.headers['set-cookie'])
      .expect(200)
    expect(refreshed.body.result).toEqual(expect.any(String))

    const logout = await request(url).post('/api/public/auth/logout').expect(200)
    expect(logout.headers['set-cookie'][0]).toContain('refreshToken=;')
  })

  it('stores the password only as a hash and rejects a duplicate email', async () => {
    const { user } = await signUp('alice@example.com')

    expect(user.passwordHash).not.toContain(password)
    await request(url)
      .post('/api/public/users')
      .send({ email: 'alice@example.com', name: 'Alice', password })
      .expect(400)
  })

  it('rejects wrong credentials and unverified users at login', async () => {
    await signUp('alice@example.com')

    await request(url).post('/api/public/auth/login').send({ email: 'alice@example.com', password }).expect(403)
    await request(url)
      .post('/api/public/auth/login')
      .send({ email: 'alice@example.com', password: 'Wr0ng!pass' })
      .expect(401)
  })
})

describe('authorization', () => {
  it('keeps a regular player out of the admin routes', async () => {
    const { user, accessToken } = await signUpVerifiedAndLogIn('alice@example.com')

    await request(url).get('/api/private/users').set(bearer(accessToken)).expect(403)
    await request(url).put(`/api/private/users/${user.id}`).set(bearer(accessToken)).send({ name: 'Bob' }).expect(403)
    await request(url)
      .put(`/api/private/users/${user.id}`)
      .set(bearer(accessToken))
      .send({ status: 'owner' })
      .expect(403)
    await request(url).get('/api/private/statistics').set(bearer(accessToken)).expect(403)
    expect(await database.client.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ status: 'user' })
  })

  it('lets an admin list users and edit a regular one', async () => {
    const { user } = await signUpVerifiedAndLogIn('alice@example.com')
    const admin = buildUser({ status: 'admin', email: 'admin@example.com' })
    await database.client.user.create({ data: { ...admin } })
    const adminToken = signAccessToken({ user: { _id: admin.id } })

    const list = await request(url).get('/api/private/users?status=user').set(bearer(adminToken)).expect(200)
    expect(list.body.result.map((u: { _id: string }) => u._id)).toEqual([user.id])
    expect(JSON.stringify(list.body)).not.toContain('passwordHash')

    await request(url).put(`/api/private/users/${user.id}`).set(bearer(adminToken)).send({ name: 'Bobby' }).expect(200)
    const stats = await request(url).get('/api/private/statistics').set(bearer(adminToken)).expect(200)
    expect(stats.body.result.usersByStatus).toMatchObject({ admin: 1, user: 1 })
  })

  it('rejects banned users on every request even with a token that is still valid', async () => {
    const { user, accessToken, cookie } = await signUpVerifiedAndLogIn('alice@example.com')
    await database.client.user.update({ where: { id: user.id }, data: { status: 'banned' } })

    await request(url).get('/api/private/auth/verify').set(bearer(accessToken)).expect(403)
    await request(url).get('/api/public/auth/refresh').set('Cookie', cookie).expect(403)
    await request(url).post('/api/public/auth/login').send({ email: 'alice@example.com', password }).expect(403)
  })

  it('does not trust the role written in a token', async () => {
    const { user } = await signUpVerifiedAndLogIn('alice@example.com')
    const forged = signAccessToken({ user: { _id: user.id, status: 'owner' } })

    await request(url).get('/api/private/users').set(bearer(forged)).expect(403)
  })

  it('rejects missing, malformed and expired tokens', async () => {
    const { user } = await signUpVerifiedAndLogIn('alice@example.com')

    await request(url).get('/api/private/auth/verify').expect(401)
    await request(url).get('/api/private/auth/verify').set(bearer('garbage')).expect(401)
    await request(url)
      .get('/api/private/auth/verify')
      .set(bearer(signAccessToken({ user: { _id: user.id } }, { expiresIn: -10 })))
      .expect(401)
  })
})

describe('game flows', () => {
  it('deploys a base once, scans around it and reads bots and modules over HTTP', async () => {
    const { user, accessToken } = await signUpVerifiedAndLogIn('alice@example.com')

    const deployed = await request(url).post('/api/private/bots/base').set(bearer(accessToken)).expect(200)
    const botId = deployed.body.bot._id
    expect(deployed.body.bot).toMatchObject({ userId: user.id, type: 'base' })
    expect(deployed.body.modules).toHaveLength(7)
    expect(await database.client.module.count({ where: { botId } })).toBe(7)

    await request(url).post('/api/private/bots/base').set(bearer(accessToken)).expect(403)

    const scan = await request(url).post(`/api/private/bots/${botId}/scan`).set(bearer(accessToken)).expect(200)
    expect(scan.body).toHaveLength(9)
    expect(await database.client.knownPoint.count({ where: { userId: user.id } })).toBe(9)

    const stranger = await signUpVerifiedAndLogIn('bob@example.com', 'Bob')
    await request(url).post(`/api/private/bots/${botId}/scan`).set(bearer(stranger.accessToken)).expect(403)
    await request(url).post('/api/private/bots/not-an-id/scan').set(bearer(accessToken)).expect(400)
  })
})

describe('Socket.IO', () => {
  const open = (token: unknown) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = connect(url, { auth: { token }, reconnection: false, transports: ['websocket'] })
      socket.on('connect', () => resolve(socket))
      socket.on('connect_error', (error) => {
        socket.close()
        reject(error)
      })
    })

  const emit = (socket: Socket, event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack)))

  it('serves get-user-bases, get-user-bots and get-bot-modules to the owner only', async () => {
    const { accessToken } = await signUpVerifiedAndLogIn('alice@example.com')
    const deployed = await request(url).post('/api/private/bots/base').set(bearer(accessToken)).expect(200)
    const botId = deployed.body.bot._id
    const stranger = await signUpVerifiedAndLogIn('bob@example.com', 'Bob')

    const alice = await open(accessToken)
    const bob = await open(stranger.accessToken)

    try {
      expect(await emit(alice, 'get-user-bases')).toEqual([[expect.objectContaining({ _id: botId })]])
      expect(await emit(alice, 'get-user-bots')).toEqual([[expect.objectContaining({ _id: botId })]])
      expect((await emit(alice, 'get-bot-modules', botId))[0]).toHaveLength(7)
      expect(await emit(bob, 'get-user-bots')).toEqual([[]])
      expect((await emit(bob, 'get-bot-modules', botId))[1]).toMatchObject({ code: 403 })
      expect((await emit(alice, 'get-bot-modules', { $ne: 1 }))[1]).toMatchObject({ code: 400 })
    } finally {
      alice.close()
      bob.close()
    }
  })

  it('rejects the handshake of missing, expired, invalid and banned users', async () => {
    const { user, accessToken } = await signUpVerifiedAndLogIn('alice@example.com')

    await expect(open(undefined)).rejects.toThrow('Unauthorized')
    await expect(open('garbage')).rejects.toThrow('Unauthorized')
    await expect(open(signAccessToken({ user: { _id: user.id } }, { expiresIn: -10 }))).rejects.toThrow('Token expired')

    await database.client.user.update({ where: { id: user.id }, data: { status: 'banned' } })
    await expect(open(accessToken)).rejects.toThrow('Unauthorized')
  })
})
