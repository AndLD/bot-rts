import { randomUUID } from 'crypto'
import { BlueprintSource } from '../../../../lib/utils/interfaces/crafting'
import { buildBase, buildItem, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { SystemClock } from '../../shared/infrastructure/system-clock'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaBlueprintRepository } from './prisma-blueprint.repository'
import { PrismaItemRepository } from './prisma-item.repository'

let database: TestDatabase
let userId: string
let baseId: string

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  userId = user.id
  baseId = base.id
})
afterAll(() => database.drop())

describe('PrismaBlueprintRepository', () => {
  it('stores the blueprints a player learned, once each', async () => {
    const blueprints = new PrismaBlueprintRepository(database.client, new SystemClock())

    await blueprints.add({ userId, module: 'scanner-class2', source: BlueprintSource.RESEARCH })
    await blueprints.add({ userId, module: 'scanner-class2', source: BlueprintSource.ITEM })
    await blueprints.add({ userId, module: 'gun-class2', source: BlueprintSource.ITEM })

    expect(await blueprints.listOfUser(userId)).toEqual([
      { userId, module: 'gun-class2', source: 'item' },
      { userId, module: 'scanner-class2', source: 'research' }
    ])
    expect(await blueprints.listOfUser(randomUUID())).toEqual([])
  })
})

describe('PrismaItemRepository', () => {
  it('stores an item on the map or carried by a bot, finds it and removes it', async () => {
    const items = new PrismaItemRepository(database.client)
    const lying = buildItem()
    const carried = buildItem({ botId: baseId, name: 'gun-class2' })

    await items.add(lying)
    await items.add(carried)

    expect(await items.findById(lying.id)).toEqual(lying)
    expect(await items.findById(randomUUID())).toBeNull()
    expect(await items.listOfBot(baseId)).toEqual([carried])

    await items.remove(carried.id)
    await items.remove(carried.id)
    expect(await items.listOfBot(baseId)).toEqual([])
  })
})
