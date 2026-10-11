import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { urlForDatabase } from '../tests/integration/database-url'
import { bootstrap } from './bootstrap'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})
afterAll(() => database.drop())

describe('bootstrap', () => {
  it('starts listening on the configured port and shuts down cleanly', async () => {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`

    const app = await bootstrap({ DATABASE_URL: urlForDatabase(db), PORT: '0', NODE_ENV: 'test' })

    expect(app.getHttpServer().listening).toBe(true)
    await app.close()
  })

  it('refuses to start with an invalid configuration', async () => {
    await expect(bootstrap({ NODE_ENV: 'test' })).rejects.toThrow('DATABASE_URL')
  })
})
