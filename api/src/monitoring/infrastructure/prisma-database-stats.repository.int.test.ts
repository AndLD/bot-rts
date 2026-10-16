import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaDatabaseStatsRepository } from './prisma-database-stats.repository'

let database: TestDatabase
let repository: PrismaDatabaseStatsRepository

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaDatabaseStatsRepository(database.client)
})
afterAll(() => database.drop())

describe('PrismaDatabaseStatsRepository', () => {
  it('counts the connections open to this database and the maximum the server allows', async () => {
    const { open, max } = await repository.connections()

    expect(open).toBeGreaterThanOrEqual(1)
    expect(max).toBeGreaterThanOrEqual(open)
  })

  it('reports the size of the database and of its largest table', async () => {
    const { totalBytes, largestTableBytes } = await repository.sizes()

    expect(totalBytes).toBeGreaterThan(0)
    expect(largestTableBytes).toBeGreaterThan(0)
    expect(largestTableBytes).toBeLessThanOrEqual(totalBytes)
  })
})
