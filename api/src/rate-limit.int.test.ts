import request from 'supertest'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { startTestApp, TestApp } from '../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, {
    RATE_LIMIT_AUTH_MAX: '3',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_API_MAX: '4',
    HTTP_BODY_LIMIT_BYTES: '2048'
  })
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('rate limit of the auth routes', () => {
  it('answers 429 with the API error body once the limit is used up, and leaves other routes alone', async () => {
    const login = () => request(testApp.url).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'x' })

    for (let i = 0; i < 3; i += 1) {
      await login().expect(401)
    }
    const blocked = await login().expect(429)

    expect(blocked.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' })
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    await request(testApp.url).get('/api/v1/health').expect(200)
  })

  it('limits every other route by the api rule, shows what is left, and never limits the health check', async () => {
    const read = () => request(testApp.url).get('/api/v1/time')

    const first = await read().expect(401)
    expect(first.headers['x-ratelimit-limit']).toBe('4')
    expect(first.headers['x-ratelimit-remaining']).toBe('3')
    await read().expect(401)
    await read().expect(401)
    await read().expect(401)
    await read().expect(429)

    for (let i = 0; i < 6; i += 1) {
      await request(testApp.url).get('/api/v1/health').expect(200)
    }
  })

  it('refuses a body above the limit with 413 and its own code', async () => {
    const response = await request(testApp.url)
      .post('/api/v1/auth/logout')
      .send({ filler: 'x'.repeat(4096) })
      .expect(413)

    expect(response.body).toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' })
  })
})
