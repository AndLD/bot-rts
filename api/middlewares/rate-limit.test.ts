import request from 'supertest'
import { makeApp } from '../tests/http'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('answers 429 with the API error body after the limit is reached', async () => {
    const app = makeApp((app) => {
      app.post('/login', createRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => res.sendStatus(200))
    })

    await request(app).post('/login').expect(200)
    await request(app).post('/login').expect(200)
    const blocked = await request(app).post('/login').expect(429)

    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS')
  })
})
