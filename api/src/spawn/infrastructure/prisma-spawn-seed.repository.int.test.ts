import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaSpawnSeedRepository } from './prisma-spawn-seed.repository'

let database: TestDatabase
let seeds: PrismaSpawnSeedRepository

const createdAt = new Date('2026-06-01T12:00:00.000Z')

async function player() {
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  return { userId: user.id, baseId: base.id }
}

beforeAll(async () => {
  database = await createTestDatabase()
  seeds = new PrismaSpawnSeedRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

describe('PrismaSpawnSeedRepository', () => {
  it('stores a seed with its anchor and finds it by code', async () => {
    await seeds.add({ code: 'ALPHA-7K2', anchor: { x: -5, y: 8, z: 0 }, createdAt })

    expect(await seeds.find('ALPHA-7K2')).toEqual({ code: 'ALPHA-7K2', anchor: { x: -5, y: 8, z: 0 }, createdAt })
    expect(await seeds.find('NOPE-000')).toBeNull()
  })

  it('keeps one membership per player and replaces the base on a new start', async () => {
    await seeds.add({ code: 'ALPHA-7K2', anchor: { x: 0, y: 0, z: 0 }, createdAt })
    const [first, second] = [await player(), await player()]
    await seeds.saveMember({ seedCode: 'ALPHA-7K2', ...first })
    await seeds.saveMember({ seedCode: 'ALPHA-7K2', ...second })

    const again = await player()
    await seeds.saveMember({ seedCode: 'ALPHA-7K2', userId: first.userId, baseId: again.baseId })

    const members = await seeds.membersOf('ALPHA-7K2')
    expect(members).toHaveLength(2)
    expect(members.find((m) => m.userId === first.userId)?.baseId).toBe(again.baseId)
    expect(await seeds.membersOf('OTHER')).toEqual([])
  })

  it('forgets a member when the base goes away, and the members when the seed does', async () => {
    await seeds.add({ code: 'ALPHA-7K2', anchor: { x: 0, y: 0, z: 0 }, createdAt })
    const member = await player()
    await seeds.saveMember({ seedCode: 'ALPHA-7K2', ...member })

    await database.client.bot.delete({ where: { id: member.baseId } })
    expect(await seeds.membersOf('ALPHA-7K2')).toEqual([])

    const other = await player()
    await seeds.saveMember({ seedCode: 'ALPHA-7K2', ...other })
    await database.client.spawnSeed.delete({ where: { code: 'ALPHA-7K2' } })
    expect(await database.client.spawnSeedMember.count()).toBe(0)
  })
})
