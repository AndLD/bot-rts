import request from 'supertest'
import { makeApp } from '../tests/http'
import { validateIdParam } from './validateId'

const app = makeApp((app) => {
  app.get('/bots/:id', validateIdParam('id'), (_req, res) => res.sendStatus(200))
})

describe('validateIdParam', () => {
  it('passes a valid id', async () => {
    await request(app).get('/bots/0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e').expect(200)
  })

  it('rejects an invalid id', async () => {
    await request(app).get('/bots/not-an-id').expect(400)
  })
})
