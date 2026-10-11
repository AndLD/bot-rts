import request from 'supertest'
import { makeApp } from '../tests/helpers'
import { createDevelopmentOnly } from './developmentOnly'

const appFor = (isEnabled: boolean) =>
  makeApp((app) => {
    app.get('/debug', createDevelopmentOnly(isEnabled), (_req, res) => res.sendStatus(200))
  })

describe('developmentOnly', () => {
  it('lets requests through in development', async () => {
    await request(appFor(true)).get('/debug').expect(200)
  })

  it('hides the route elsewhere', async () => {
    await request(appFor(false)).get('/debug').expect(404)
  })
})
