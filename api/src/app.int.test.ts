import { AddressInfo } from 'net'
import { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { urlForDatabase } from '../tests/integration/database-url'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { createApp } from './app.factory'
import { loadConfig } from './config/app-config'

let database: TestDatabase
let app: NestExpressApplication
let url: string

beforeAll(async () => {
  database = await createTestDatabase()
  const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  app = await createApp(
    loadConfig({
      DATABASE_URL: urlForDatabase(db),
      NODE_ENV: 'test',
      WHITELIST_URLS: 'https://play.example'
    })
  )
  await app.listen(0)
  url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`
})
afterAll(async () => {
  await app.close()
  await database.drop()
})

describe('the Nest application', () => {
  it('answers the versioned health endpoint', async () => {
    const response = await request(url).get('/api/v1/health').expect(200)

    expect(response.body).toEqual({ status: 'ok', database: 'up' })
  })

  it('reports unknown routes with the API error body', async () => {
    const response = await request(url).get('/api/v1/nope').expect(404)

    expect(response.body).toEqual({ statusCode: 404, code: 'NOT_FOUND', error: 'Not found' })
    await request(url).get('/api/health').expect(404)
  })

  it('still serves the legacy routes next to the Nest ones', async () => {
    await request(url).get('/api/private/auth/verify').expect(401)
  })

  it('publishes the OpenAPI document', async () => {
    const response = await request(url).get('/api/docs-json').expect(200)

    expect(response.body.paths['/api/v1/health']).toBeDefined()
  })

  it('allows only the configured origins and sets security headers', async () => {
    const allowed = await request(url).get('/api/v1/health').set('Origin', 'https://play.example').expect(200)
    expect(allowed.headers['access-control-allow-origin']).toBe('https://play.example')
    expect(allowed.headers['x-content-type-options']).toBe('nosniff')

    const foreign = await request(url).get('/api/v1/health').set('Origin', 'https://evil.example')
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined()
    expect(foreign.status).toBe(403)
  })
})
