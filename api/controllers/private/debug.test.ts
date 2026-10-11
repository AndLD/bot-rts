import request from 'supertest'
import { dbService } from '../../services/db'
import { debugPrivateRouter } from '../../routers/private/debug'
import { makeApp } from '../../tests/helpers'

jest.mock('../../services/db', () => ({ dbService: { deleteAll: jest.fn() } }))

const app = makeApp((app) => {
  app.use(debugPrivateRouter)
})

beforeEach(() => jest.resetAllMocks())

describe('DELETE /collections', () => {
  it('requires the collections parameter', async () => {
    await request(app).delete('/collections').expect(400)
    await request(app).delete('/collections?collections[]=users').expect(400)
  })

  it('refuses collections outside the known entities', async () => {
    await request(app).delete('/collections?collections=users,system.users').expect(400)
    expect(dbService.deleteAll).not.toHaveBeenCalled()
  })

  it('clears known collections', async () => {
    await request(app).delete('/collections?collections=bots,modules').expect(200)
    expect(dbService.deleteAll).toHaveBeenCalledWith('bots')
    expect(dbService.deleteAll).toHaveBeenCalledWith('modules')
  })
})
