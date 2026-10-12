import { withDefaults } from '../../../../lib/utils/interfaces/settings'
import { buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaSettingsRepository } from './prisma-settings.repository'

let database: TestDatabase
let settings: PrismaSettingsRepository
let userId: string

beforeAll(async () => {
  database = await createTestDatabase()
  settings = new PrismaSettingsRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  userId = user.id
})
afterAll(() => database.drop())

describe('PrismaSettingsRepository', () => {
  it('reads the defaults of a game and a player that set nothing', async () => {
    expect(await settings.getGameCategories()).toEqual(withDefaults(undefined))
    expect(await settings.getUser(userId)).toEqual({ categories: withDefaults(undefined), reducedMotion: null })
  })

  it('stores the switches of the game and replaces them', async () => {
    await settings.saveGameCategories(withDefaults({ combat: false }))
    expect((await settings.getGameCategories()).combat).toBe(false)

    await settings.saveGameCategories(withDefaults({ trade: false }))
    expect(await settings.getGameCategories()).toMatchObject({ combat: true, trade: false })
  })

  it('stores the settings of a player, and removes them with the player', async () => {
    await settings.saveUser(userId, { categories: withDefaults({ movement: false }), reducedMotion: true })
    expect(await settings.getUser(userId)).toEqual({
      categories: withDefaults({ movement: false }),
      reducedMotion: true
    })

    await settings.saveUser(userId, { categories: withDefaults(undefined), reducedMotion: null })
    expect((await settings.getUser(userId)).reducedMotion).toBeNull()

    await database.client.user.delete({ where: { id: userId } })
    expect(await database.client.userSetting.count()).toBe(0)
  })

  it('stamps the time of a change with the clock it is given', async () => {
    const fixed = new PrismaSettingsRepository(database.client, () => new Date('2026-01-02T03:04:05.000Z'))

    await fixed.saveUser(userId, { categories: withDefaults(undefined), reducedMotion: false })

    expect((await database.client.userSetting.findUniqueOrThrow({ where: { userId } })).updatedAt.toISOString()).toBe(
      '2026-01-02T03:04:05.000Z'
    )
  })
})
