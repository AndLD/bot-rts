import request from 'supertest'
import { asUser, makeApp } from '../tests/helpers'
import { hasAdminStatus, hasOwnerStatus } from './users'

jest.mock('../services/users', () => ({ usersService: { findUserById: jest.fn() } }))

const appFor = (status: string | undefined, guard: typeof hasAdminStatus) =>
  makeApp((app) => {
    app.get('/x', asUser(status ? { status } : {}), guard, (_req, res) => res.sendStatus(200))
  })

describe('role guards', () => {
  it.each([
    ['owner', 200],
    ['admin', 200],
    ['user', 403],
    ['unlimited', 403],
    [undefined, 403]
  ])('hasAdminStatus for %p -> %p', async (status, code) => {
    await request(appFor(status, hasAdminStatus)).get('/x').expect(code)
  })

  it.each([
    ['owner', 200],
    ['admin', 403],
    [undefined, 403]
  ])('hasOwnerStatus for %p -> %p', async (status, code) => {
    await request(appFor(status, hasOwnerStatus)).get('/x').expect(code)
  })
})
