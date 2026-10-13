import { buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaAchievementRepository } from './prisma-achievement.repository'

let database: TestDatabase
let userId: string
let repository: PrismaAchievementRepository
const at = new Date('2026-10-13T10:00:00Z')

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  userId = user.id
  repository = new PrismaAchievementRepository(database.client, () => at)
})
afterAll(() => database.drop())

describe('PrismaAchievementRepository', () => {
  it('adds to the counters and gives the totals', async () => {
    expect(await repository.addToCounters(userId, { unitsMined: 5, cellsScanned: 9 })).toEqual({
      unitsMined: 5,
      cellsScanned: 9
    })
    expect(await repository.addToCounters(userId, { unitsMined: 7 })).toEqual({ unitsMined: 12 })

    expect(await repository.counters(userId)).toEqual({ unitsMined: 12, cellsScanned: 9 })
  })

  it('ignores a counter it does not know when reading', async () => {
    await database.client.achievementCounter.create({ data: { userId, counter: 'retired', value: 3, updatedAt: at } })

    expect(await repository.counters(userId)).toEqual({})
  })

  it('records an unlock once, oldest first', async () => {
    expect(await repository.unlock(userId, 'miner.1', at)).toBe(true)
    expect(await repository.unlock(userId, 'miner.1', new Date(at.getTime() + 1000))).toBe(false)
    await repository.unlock(userId, 'firstSteps', new Date(at.getTime() - 1000))

    expect(await repository.unlocks(userId)).toEqual([
      { achievementId: 'firstSteps', unlockedAt: new Date(at.getTime() - 1000) },
      { achievementId: 'miner.1', unlockedAt: at }
    ])
  })

  it('is erased with the player', async () => {
    await repository.addToCounters(userId, { unitsMined: 1 })
    await repository.unlock(userId, 'miner.1', at)

    await database.client.user.delete({ where: { id: userId } })

    expect(await database.client.achievementCounter.count()).toBe(0)
    expect(await database.client.achievementUnlock.count()).toBe(0)
  })
})
