import request from 'supertest'
import { createFakeServices } from '../../tests/fakes/services'
import { buildUser } from '../../tests/integration/builders'
import { asUser, makeApp } from '../../tests/http'
import { authPrivateRouter } from './auth'
import { createStatisticsPrivateRouter } from './statistics'

describe('GET /statistics', () => {
  const appFor = (status: 'admin' | 'user') => {
    const fake = createFakeServices()
    fake.repositories.users.items.set('u', buildUser({ id: 'u', status: 'user' }))
    return makeApp((app) => {
      app.use(asUser(buildUser({ status })), createStatisticsPrivateRouter(fake.services))
    })
  }

  it('shows users by status to admins', async () => {
    const response = await request(appFor('admin')).get('/').expect(200)

    expect(response.body.result.usersByStatus.user).toBe(1)
    expect(response.body.result.startTimestamp).toEqual(expect.any(Number))
  })

  it('is admin-only', async () => {
    await request(appFor('user')).get('/').expect(403)
  })
})

describe('GET /auth/verify', () => {
  it('answers 200 for a request that passed authorization', async () => {
    await request(makeApp((app) => app.use(authPrivateRouter)))
      .get('/verify')
      .expect(200)
  })
})
