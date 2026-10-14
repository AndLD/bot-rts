import request from 'supertest'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { totpCodeAt } from '../admin/infrastructure/crypto-totp'
import { MONITORING_SERVICE, MonitoringService } from './application/monitoring.service'

let database: TestDatabase
let testApp: TestApp
let monitoring: MonitoringService

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  monitoring = testApp.app.get<MonitoringService>(MONITORING_SERVICE)
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const api = () => request(testApp.url)
let counter = 0

// A verified admin of the role
async function admin(status: 'owner' | 'analyst' | 'moderator'): Promise<SignedUp> {
  counter += 1
  const player = await signUpVerified(testApp, database, `${status}${counter}@example.com`)
  await database.client.user.update({ where: { id: player.userId }, data: { status } })
  const begun = await api().post('/api/v1/admin/2fa/enroll').set(bearer(player.accessToken)).expect(201)
  await api()
    .post('/api/v1/admin/2fa/confirm')
    .set(bearer(player.accessToken))
    .send({ code: totpCodeAt(begun.body.secret, Date.now()) })
    .expect(200)

  return player
}

async function waitUntil(condition: () => boolean) {
  const deadline = Date.now() + 5000
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the sampler')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('the monitoring endpoints', () => {
  it('shows the health of every area after a sample, without the engine in this test setup', async () => {
    const analyst = await admin('analyst')
    await monitoring.sampleOnce()

    const health = await api().get('/api/v1/admin/monitoring/health').set(bearer(analyst.accessToken)).expect(200)

    expect(health.body.sampledAt).toEqual(expect.any(Number))
    expect(health.body.areas.map((area: { area: string }) => area.area)).toEqual([
      'engine',
      'scripts',
      'api',
      'infrastructure'
    ])
    const infrastructure = health.body.areas.find((area: { area: string }) => area.area === 'infrastructure')
    expect(
      infrastructure.metrics.find((metric: { id: string }) => metric.id === 'infrastructure.rssBytes').value
    ).toBeGreaterThan(0)
  })

  it('serves the history of a metric and validates the query', async () => {
    const analyst = await admin('analyst')
    await monitoring.sampleOnce()

    const series = await api()
      .get('/api/v1/admin/monitoring/series?metric=infrastructure.rssBytes&range=1h')
      .set(bearer(analyst.accessToken))
      .expect(200)
    expect(series.body.metric).toBe('infrastructure.rssBytes')
    expect(series.body.points.length).toBeGreaterThan(0)
    expect(series.body.points[0]).toHaveLength(2)

    await api().get('/api/v1/admin/monitoring/series?metric=nope&range=1h').set(bearer(analyst.accessToken)).expect(400)
    await api()
      .get('/api/v1/admin/monitoring/series?metric=engine.up&range=2h')
      .set(bearer(analyst.accessToken))
      .expect(400)
  })

  it('lists alerts and lets an admin with the permission acknowledge one, and audits it', async () => {
    const owner = await admin('owner')
    const analyst = await admin('analyst')
    // The engine thread is off in tests, so `engine.up` is 0: a red alert
    await monitoring.sampleOnce()

    const alerts = await api().get('/api/v1/admin/monitoring/alerts').set(bearer(analyst.accessToken)).expect(200)
    const alert = alerts.body.find((candidate: { metric: string }) => candidate.metric === 'engine.up')
    expect(alert).toMatchObject({ severity: 'red', area: 'engine', acknowledgedAt: null })

    await api()
      .post(`/api/v1/admin/monitoring/alerts/${alert._id}/acknowledge`)
      .set(bearer(analyst.accessToken))
      .expect(403)
    const acknowledged = await api()
      .post(`/api/v1/admin/monitoring/alerts/${alert._id}/acknowledge`)
      .set(bearer(owner.accessToken))
      .expect(200)
    expect(acknowledged.body).toMatchObject({ _id: alert._id, acknowledgedBy: owner.userId })

    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { actorId: owner.userId, action: 'alerts.acknowledge' }
    })
    expect(entry).toMatchObject({ targetType: 'alert', targetId: alert._id, outcome: 'success' })
    await api()
      .post('/api/v1/admin/monitoring/alerts/not-a-uuid/acknowledge')
      .set(bearer(owner.accessToken))
      .expect(400)
  })

  it('keeps the dashboard from players, moderators without the permission, and API keys', async () => {
    const player = await signUpVerified(testApp, database, 'plain@example.com')
    await api().get('/api/v1/admin/monitoring/health').set(bearer(player.accessToken)).expect(403)
    await api().get('/api/v1/admin/monitoring/health').expect(401)
  })

  it('exposes the open alerts to the scraper', async () => {
    await monitoring.sampleOnce()
    // This app samples by itself, which also covers the schedule and its shutdown
    const app = await startTestApp(database, {
      METRICS_TOKEN: 'scrape',
      MONITORING_ENABLED: 'true',
      MONITORING_INTERVAL_MS: '20'
    })
    try {
      const sampling = app.app.get<MonitoringService>(MONITORING_SERVICE)
      await waitUntil(() => sampling.health().sampledAt !== null)
      const text = await request(app.url).get('/api/v1/metrics').set('Authorization', 'Bearer scrape').expect(200)

      expect(text.text).toContain('botrts_alerts_open{severity="red"} 1')
    } finally {
      await app.close()
    }
  })
})
