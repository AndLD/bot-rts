import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { buildUser } from '../../../tests/integration/builders'
import { PrismaUserRepository } from './prisma-user.repository'

let database: TestDatabase
let users: PrismaUserRepository

beforeAll(async () => {
  database = await createTestDatabase()
  users = new PrismaUserRepository(database.client)
})
beforeEach(() => database.reset())
afterAll(() => database.drop())

describe('PrismaUserRepository', () => {
  it('stores and finds a user by id and email', async () => {
    const user = buildUser({ email: 'alice@example.com' })

    await users.add(user)

    expect(await users.findById(user.id)).toEqual(user)
    expect(await users.findByEmail('alice@example.com')).toEqual(user)
    expect(await users.findById('11111111-1111-4111-8111-111111111111')).toBeNull()
    expect(await users.findByEmail('nobody@example.com')).toBeNull()
  })

  it('rejects a duplicate email', async () => {
    await users.add(buildUser({ email: 'a@example.com' }))

    await expect(users.add(buildUser({ email: 'a@example.com' }))).rejects.toThrow()
  })

  it('updates every mutable field', async () => {
    const user = buildUser({ isActive: false })
    await users.add(user)

    const changed = {
      ...user,
      name: 'Bob',
      status: 'banned' as const,
      isActive: true,
      updatedAt: new Date('2026-02-01T00:00:00.000Z')
    }
    await users.update(changed)

    expect(await users.findById(user.id)).toEqual(changed)
  })

  it('lists users with filters, ordering and pagination', async () => {
    const [a, b, c] = [
      buildUser({ createdAt: new Date('2026-01-01'), status: 'admin' }),
      buildUser({ createdAt: new Date('2026-01-02'), isActive: false }),
      buildUser({ createdAt: new Date('2026-01-03') })
    ]
    for (const user of [c, a, b]) {
      await users.add(user)
    }

    expect((await users.list({ offset: 0, limit: 10 })).users).toEqual([a, b, c])
    expect(await users.list({ offset: 1, limit: 1 })).toEqual({ users: [b], total: 3 })
    expect((await users.list({ status: 'admin', offset: 0, limit: 10 })).users).toEqual([a])
    expect((await users.list({ isActive: false, offset: 0, limit: 10 })).users).toEqual([b])
    expect((await users.list({ email: c.email, offset: 0, limit: 10 })).users).toEqual([c])
  })

  it('counts users by status including empty statuses', async () => {
    await users.add(buildUser({ status: 'admin' }))
    await users.add(buildUser({ status: 'user' }))
    await users.add(buildUser({ status: 'user' }))

    expect(await users.countByStatus()).toEqual({ admin: 1, owner: 0, user: 2, unlimited: 0, banned: 0 })
  })

  it('deletes only old inactive users', async () => {
    const oldInactive = buildUser({ isActive: false, createdAt: new Date('2026-01-01') })
    const oldActive = buildUser({ isActive: true, createdAt: new Date('2026-01-01') })
    const newInactive = buildUser({ isActive: false, createdAt: new Date('2026-03-01') })
    for (const user of [oldInactive, oldActive, newInactive]) {
      await users.add(user)
    }

    expect(await users.deleteInactiveCreatedBefore(new Date('2026-02-01'))).toBe(1)
    expect(await users.findById(oldInactive.id)).toBeNull()
    expect(await users.findById(oldActive.id)).not.toBeNull()
    expect(await users.findById(newInactive.id)).not.toBeNull()
  })
})
