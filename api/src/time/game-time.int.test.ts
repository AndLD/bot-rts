import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { DEFAULT_GAME_TIME_SETTINGS } from '../../../lib/utils/game-time'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { GameTimeSettingsService } from './application/game-time-settings.service'
import { CLOCK } from '../shared/application/clock'
import { Clock } from '../shared/application/clock'

let database: TestDatabase
let testApp: TestApp
let settings: GameTimeSettingsService

const HOUR_MS = 3_600_000

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, {
    ENGINE_ENABLED: 'true',
    ENGINE_TICK_INTERVAL_MS: '20',
    RATE_LIMIT_API_MAX: '100000'
  })
  settings = testApp.app.get(GameTimeSettingsService)
}, 90000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const api = () => request(testApp.url)

async function deployed(email: string) {
  const player = await signUpVerified(testApp, database, email)
  const base = await api()
    .post('/api/v1/bots/base')
    .set(bearer(player.accessToken))
    .send({ password: 'secret1' })
    .expect(201)

  return { ...player, botId: base.body.bot._id as string }
}

async function lastSeenOf(userId: string): Promise<number> {
  const rows = await database.client.knownPoint.findMany({ where: { userId }, select: { seenAt: true } })

  return Math.max(...rows.map((row) => Number(row.seenAt)))
}

describe('the game time', () => {
  it('starts as the real time with the default day, and a time in the future is only in the game, not for logins', async () => {
    const player = await deployed('time-1@example.com')
    const before = await api().get('/api/v1/time').set(bearer(player.accessToken)).expect(200)

    expect(Math.abs(before.body.now - Date.now())).toBeLessThan(5000)
    expect(before.body.config).toMatchObject({ dayLengthMs: 24 * 60 * 1000 })

    await settings.update({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs: HOUR_MS })

    const after = await api().get('/api/v1/time').set(bearer(player.accessToken)).expect(200)
    expect(after.body.now - Date.now()).toBeGreaterThan(HOUR_MS - 5000)
    // Sessions, logins and the audit trail stay on the real clock: the same token still works
    await api().get('/api/v1/users/me').set(bearer(player.accessToken)).expect(200)
    const real = testApp.app.get<Clock>(CLOCK).now().getTime()
    expect(Math.abs(real - Date.now())).toBeLessThan(5000)
    await settings.update(DEFAULT_GAME_TIME_SETTINGS, { isResetOfOffset: true })
  })

  it('is followed by the engine: what the engine records after a change is stamped with the new time', async () => {
    const player = await deployed('time-2@example.com')
    await api().post(`/api/v1/bots/${player.botId}/scan`).set(bearer(player.accessToken)).expect(200)
    const first = await lastSeenOf(player.userId)
    expect(Math.abs(first - Date.now())).toBeLessThan(HOUR_MS / 2)

    await settings.update({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs: 5 * HOUR_MS })
    await api().post(`/api/v1/bots/${player.botId}/scan`).set(bearer(player.accessToken)).expect(200)

    expect(await lastSeenOf(player.userId)).toBeGreaterThan(Date.now() + 4 * HOUR_MS)
  })

  it('is read by an API node from the store: a change made by another process is followed', async () => {
    await database.client.gameSetting.upsert({
      where: { key: 'gameTime' },
      create: {
        key: 'gameTime',
        value: { ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 120_000, anchorMs: 7 },
        updatedAt: new Date()
      },
      update: { value: { ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 120_000, anchorMs: 7 }, updatedAt: new Date() }
    })
    const player = await signUpVerified(testApp, database, 'time-3@example.com')

    const shown = await api().get('/api/v1/time').set(bearer(player.accessToken)).expect(200)

    expect(shown.body.config).toMatchObject({ dayLengthMs: 120_000, anchorMs: 7 })
  })
})

describe('the socket event of a change', () => {
  const open = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const opened = connect(testApp.url, { auth: { token }, reconnection: false, transports: ['websocket'] })
      opened.on('connect', () => resolve(opened))
      opened.on('connect_error', reject)
    })

  it('tells every connected client once per change, after the new time is in force', async () => {
    const first = await signUpVerified(testApp, database, 'time-s1@example.com')
    const second = await signUpVerified(testApp, database, 'time-s2@example.com')
    const sockets = await Promise.all([open(first.accessToken), open(second.accessToken)])
    const heard: number[] = [0, 0]
    const seenAtEvent: number[] = []
    sockets.forEach((socket, index) =>
      socket.on('game-time-changed' as never, () => {
        heard[index] += 1
        seenAtEvent.push(settings.current().dayLengthMs)
      })
    )

    await settings.update({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 48 * 60_000 })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const read = await api().get('/api/v1/time').set(bearer(first.accessToken)).expect(200)

    expect(heard).toEqual([1, 1])
    expect(seenAtEvent).toEqual([48 * 60_000, 48 * 60_000])
    expect(read.body.config.dayLengthMs).toBe(48 * 60_000)

    await settings.update({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 48 * 60_000 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(heard).toEqual([2, 2])
    sockets.forEach((socket) => socket.close())
  })
})
