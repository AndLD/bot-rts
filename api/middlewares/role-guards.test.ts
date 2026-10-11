import { UserStatus } from '../../lib/utils/interfaces/users'
import request from 'supertest'
import { buildUser } from '../tests/integration/builders'
import { asUser, makeApp } from '../tests/http'
import { hasAdminStatus, hasOwnerStatus } from './users'

const appFor = (status: UserStatus, guard: typeof hasAdminStatus) =>
  makeApp((app) => {
    app.get('/x', asUser(buildUser({ status })), guard, (_req, res) => res.sendStatus(200))
  })

describe('role guards', () => {
  it.each([
    ['owner', 200],
    ['admin', 200],
    ['user', 403],
    ['unlimited', 403],
    ['banned', 403]
  ] as const)('hasAdminStatus for %s -> %s', async (status, code) => {
    await request(appFor(status, hasAdminStatus)).get('/x').expect(code)
  })

  it.each([
    ['owner', 200],
    ['admin', 403]
  ] as const)('hasOwnerStatus for %s -> %s', async (status, code) => {
    await request(appFor(status, hasOwnerStatus)).get('/x').expect(code)
  })

  it('rejects requests without a user', async () => {
    const app = makeApp((app) => {
      app.get('/x', hasAdminStatus, (_req, res) => res.sendStatus(200))
      app.get('/y', hasOwnerStatus, (_req, res) => res.sendStatus(200))
    })

    await request(app).get('/x').expect(403)
    await request(app).get('/y').expect(403)
  })
})
