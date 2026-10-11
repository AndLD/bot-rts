import request from 'supertest'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { startTestApp, TestApp } from '../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_AUTH_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000' })
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
    await request(testApp.url).get('/api/v1/health').expect(200)
  })
})
