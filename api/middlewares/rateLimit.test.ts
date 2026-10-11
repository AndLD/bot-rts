import request from 'supertest'
import { makeApp } from '../tests/helpers'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('answers 429 after the limit is reached', async () => {
    const app = makeApp((app) => {
      app.post('/login', createRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => res.sendStatus(200))
    })

    await request(app).post('/login').expect(200)
    await request(app).post('/login').expect(200)
    const blocked = await request(app).post('/login').expect(429)

    expect(blocked.body.error).toBeDefined()
  })
})
