import { randomUUID } from 'crypto'
import { buildBase, buildModule, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaModuleRepository } from './prisma-module.repository'

let database: TestDatabase
let modules: PrismaModuleRepository
let baseId: string

beforeAll(async () => {
  database = await createTestDatabase()
  modules = new PrismaModuleRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  baseId = base.id
})
afterAll(() => database.drop())

describe('PrismaModuleRepository', () => {
  it('stores modules with their type-specific properties and lists them by bot', async () => {
    const gun = buildModule(baseId, { props: { damage: 50, nested: { a: [1, 2] } } })
    const battery = buildModule(baseId, {
      type: 'battery',
      name: 'battery-class1',
      props: { capacity: 3000, isConnected: true }
    })

    await modules.addMany([gun, battery])

    const stored = await modules.listOfBot(baseId)
    expect(stored).toHaveLength(2)
    expect(stored).toEqual(expect.arrayContaining([gun, battery]))
  })

  it('lists nothing for an unknown bot', async () => {
    expect(await modules.listOfBot(randomUUID())).toEqual([])
  })

  it('refuses a module of a missing bot', async () => {
    await expect(modules.addMany([buildModule(randomUUID())])).rejects.toThrow()
  })
})
