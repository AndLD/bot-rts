import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { ELASTICSEARCH, isObservabilityUp, skipOrFail, warnSkipped } from '../../tests/integration/gateway'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

// The retention of the logs set in the console reaches the lifecycle policy of the real Elasticsearch (docker-compose.yml, `npm run obs:up`)
let isAvailable = false
let database: TestDatabase
let testApp: TestApp
let broken: TestApp
let admin: SignedUp

const bearer = () => ({ Authorization: `Bearer ${admin.accessToken}` })
const patch = (app: TestApp, days: number) =>
  request(app.url)
    .patch('/api/v1/admin/retention')
    .set(bearer())
    .send({ jobs: { logs: { days } }, reason: 'tuning' })

async function deleteAfter(): Promise<string> {
  const response = await fetch(`${ELASTICSEARCH}/_ilm/policy/botrts-retention`)
  const body = (await response.json()) as {
    'botrts-retention': { policy: { phases: { delete: { min_age: string } } } }
  }

  return body['botrts-retention'].policy.phases.delete.min_age
}

beforeAll(async () => {
  isAvailable = await isObservabilityUp()
  skipOrFail(isAvailable)
  if (!isAvailable) return
  database = await createTestDatabase()
  const env = {
    LOG_STORE: 'elasticsearch',
    ELASTICSEARCH_ADMIN_API_KEY: 'a-key-the-development-store-ignores',
    LOG_RETENTION_DAYS: '14',
    RATE_LIMIT_API_MAX: '100000'
  }
  testApp = await startTestApp(database, { ...env, ELASTICSEARCH_URL: ELASTICSEARCH })
  broken = await startTestApp(database, {
    ...env,
    ELASTICSEARCH_URL: 'http://127.0.0.1:1',
    LOG_SEARCH_TIMEOUT_MS: '500'
  })
  admin = await signUpAdmin(testApp, database, 'admin')
}, 90000)

afterAll(async () => {
  if (isAvailable) {
    await patch(testApp, 14)
  }
  await testApp?.close()
  await broken?.close()
  await database?.drop()
})

describe('the retention of the logs in the console', () => {
  it('changes the lifecycle policy of the log store, and puts the default back with the reset', async () => {
    if (!isAvailable) return warnSkipped()

    await patch(testApp, 21).expect(200)
    expect(await deleteAfter()).toBe('21d')

    await request(testApp.url).post('/api/v1/admin/retention/reset').set(bearer()).send({ reason: 'back' }).expect(200)
    expect(await deleteAfter()).toBe('14d')
  })

  it('saves nothing when the log store cannot take the change, and says so', async () => {
    if (!isAvailable) return warnSkipped()

    const refused = await patch(broken, 30).expect(503)

    expect(refused.body).toMatchObject({ code: 'LOG_STORE_UNAVAILABLE' })
    const view = await request(broken.url).get('/api/v1/admin/retention').set(bearer()).expect(200)
    expect(view.body.jobs.find((job: { job: string }) => job.job === 'logs').values).toEqual({ days: 14 })
  })

  it('refuses days outside the range', async () => {
    if (!isAvailable) return warnSkipped()

    await patch(testApp, 0).expect(400)
    await patch(testApp, 366).expect(400)
  })
})
