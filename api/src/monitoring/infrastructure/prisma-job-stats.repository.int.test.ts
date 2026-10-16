import { randomUUID } from 'crypto'
import { buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaJobStatsRepository } from './prisma-job-stats.repository'

let database: TestDatabase
let repository: PrismaJobStatsRepository

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaJobStatsRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

describe('PrismaJobStatsRepository', () => {
  it('has an empty queue when nothing waits', async () => {
    expect(await repository.notificationQueue()).toEqual({ waiting: 0, oldestWaitMs: null })
  })

  it('counts the notifications whose time has come and are not delivered, and how long the oldest has waited', async () => {
    const user = buildUser()
    await new PrismaUserRepository(database.client).add(user)
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)
    const row = (createdAt: Date, deliveredAt: Date | null) => ({
      id: randomUUID(),
      userId: user.id,
      category: 'system',
      kind: 'test',
      createdAt,
      deliveredAt
    })
    await database.client.playerNotification.createMany({
      data: [
        row(minutesAgo(10), null),
        row(minutesAgo(2), null),
        row(minutesAgo(30), minutesAgo(29)),
        row(new Date(Date.now() + 3_600_000), null)
      ]
    })

    const queue = await repository.notificationQueue()

    expect(queue.waiting).toBe(2)
    expect(queue.oldestWaitMs).toBeGreaterThan(9.9 * 60_000)
    expect(queue.oldestWaitMs).toBeLessThan(11 * 60_000)
  })
})
