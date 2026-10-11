import http from 'http'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { urlForDatabase } from '../tests/integration/database-url'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
afterAll(() => database.drop())

describe('startApp / stopApp', () => {
  it('can be stopped before it was started', async () => {
    await jest.isolateModulesAsync(async () => {
      const { stopApp } = jest.requireActual('./index')

      await expect(stopApp()).resolves.toBeUndefined()
    })
  })

  it('starts listening and shuts down cleanly', async () => {
    const databaseName = (await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0].db
    Object.assign(process.env, { DATABASE_URL: urlForDatabase(databaseName), PORT: '0' })
    const listen = jest.spyOn(http.Server.prototype, 'listen')

    await jest.isolateModulesAsync(async () => {
      const { startApp, stopApp } = jest.requireActual('./index')

      await startApp()
      await new Promise((resolve) => setImmediate(resolve))
      expect(listen).toHaveBeenCalled()

      await stopApp()
    })

    listen.mockRestore()
  })
})
