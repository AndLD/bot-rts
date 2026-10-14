import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'
import { RealtimeGateway } from '../engine/presentation/realtime.gateway'
import { RedisEnginePort } from './infrastructure/redis-engine-port'

// An engine node and an API node that only share PostgreSQL and Redis (design §12.2.2, "Scaling")

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

let database: TestDatabase
let engineNode: TestApp
let apiNode: TestApp
let socket: Socket | undefined

beforeAll(async () => {
  database = await createTestDatabase()
  engineNode = await startTestApp(database, {
    APP_ROLE: 'engine',
    REDIS_URL,
    ENGINE_ENABLED: 'true',
    LIFECYCLE_ENABLED: 'true',
    ENGINE_TICK_INTERVAL_MS: '20'
  })
  apiNode = await startTestApp(database, {
    APP_ROLE: 'api',
    REDIS_URL,
    ENGINE_ENABLED: 'true',
    LIFECYCLE_ENABLED: 'true',
    METRICS_TOKEN: 'scrape'
  })
}, 90000)
afterEach(() => {
  socket?.close()
})
afterAll(async () => {
  await apiNode.close()
  await engineNode.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('an API node next to an engine node', () => {
  it('reaches the engine through Redis instead of running one', async () => {
    expect(apiNode.app.get(ENGINE_PORT)).toBeInstanceOf(RedisEnginePort)
    expect(engineNode.app.get(ENGINE_PORT)).not.toBeInstanceOf(RedisEnginePort)
    const player = await signUpVerified(apiNode, database, 'remote@example.com')

    // A request that changes the world: the API node forwards it, the engine node's thread runs it
    const deployed = await request(apiNode.url)
      .post('/api/v1/bots/base')
      .set(bearer(player.accessToken))
      .send({ password: 'secret1' })
      .expect(201)

    expect(deployed.body.bot._id).toEqual(expect.any(String))
    const scan = await request(apiNode.url)
      .post(`/api/v1/bots/${deployed.body.bot._id}/scan`)
      .set(bearer(player.accessToken))
      .expect(200)
    expect(scan.body).toHaveLength(9)
  })

  it('is ready only while the database, Redis and the engine all answer', async () => {
    const health = await request(apiNode.url).get('/api/v1/health').expect(200)
    expect(health.body).toEqual({ status: 'ok', database: 'up', redis: 'up', engine: 'up' })

    const metrics = await request(apiNode.url).get('/api/v1/metrics').set('Authorization', 'Bearer scrape').expect(200)
    expect(metrics.text).toContain('botrts_engine_up 1')
    expect(metrics.text).toMatch(/botrts_engine_tick \d+/)
    expect(metrics.text).toContain('botrts_engine_queued_executions 0')
    expect(metrics.text).toContain('botrts_lifecycle_last_run_timestamp_seconds 0')
  })

  it('delivers what one node pushes to a player who is connected to the other', async () => {
    const player = await signUpVerified(apiNode, database, 'listener@example.com')
    socket = connect(apiNode.url, {
      auth: { token: player.accessToken },
      reconnection: false,
      transports: ['websocket']
    })
    await new Promise<void>((resolve, reject) => {
      socket?.on('connect', () => resolve())
      socket?.on('connect_error', reject)
    })
    const received = new Promise((resolve) => socket?.on('notification', resolve))

    const gateway = engineNode.app.get(RealtimeGateway, { strict: false })
    // The socket joined its room on the API node; the engine node reaches it through the Redis adapter
    await new Promise((resolve) => setTimeout(resolve, 100))
    gateway.push(player.userId, 'notification', { id: 'n1' } as never)

    await expect(received).resolves.toEqual({ id: 'n1' })
  })
})
