import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaBotAccessRepository } from './prisma-bot-access.repository'

let database: TestDatabase
let repository: PrismaBotAccessRepository
let botId: string

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaBotAccessRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  botId = base.id
})
afterAll(() => database.drop())

describe('PrismaBotAccessRepository', () => {
  it('knows nothing of a bot nobody tried, then stores and replaces what it learns', async () => {
    expect(await repository.find(botId)).toBeNull()

    await repository.save(botId, { failures: 2, lockedUntil: null })
    expect(await repository.find(botId)).toEqual({ failures: 2, lockedUntil: null })

    const lockedUntil = new Date('2026-01-01T00:10:00Z')
    await repository.save(botId, { failures: 0, lockedUntil })
    expect(await repository.find(botId)).toEqual({ failures: 0, lockedUntil })
  })
})
