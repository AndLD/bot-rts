import request from 'supertest'
import { makeApp } from '../tests/helpers'
import { validateIdParam } from './validateId'

const app = makeApp((app) => {
  app.get('/bots/:id', validateIdParam('id'), (_req, res) => res.sendStatus(200))
})

describe('validateIdParam', () => {
  it('passes a valid id', async () => {
    await request(app).get('/bots/64b7f0f2a1b2c3d4e5f60718').expect(200)
  })

  it('rejects an invalid id', async () => {
    await request(app).get('/bots/not-an-id').expect(400)
  })
})
