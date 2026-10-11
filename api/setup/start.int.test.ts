import http from 'http'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { urlForDatabase } from '../tests/integration/database-url'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
afterAll(() => database.drop())

describe('startApp / stopApp', () => {
  it('starts listening and shuts down cleanly', async () => {
    const databaseName = (await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0].db
    Object.assign(process.env, { DATABASE_URL: urlForDatabase(databaseName), PORT: '0' })
    const listen = jest.spyOn(http.Server.prototype, 'listen')

    await jest.isolateModulesAsync(async () => {
      const { startApp, stopApp } = require('./index')

      await startApp()
      await new Promise((resolve) => setImmediate(resolve))
      expect(listen).toHaveBeenCalled()

      await stopApp()
    })

    listen.mockRestore()
  })
})
