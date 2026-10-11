import { buildCredential, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaCredentialRepository } from '../../auth/infrastructure/prisma-credential.repository'
import { EmailAlreadyExistsError } from '../domain/user.errors'
import { PrismaUserRepository } from './prisma-user.repository'

let database: TestDatabase
let users: PrismaUserRepository
let credentials: PrismaCredentialRepository

beforeAll(async () => {
  database = await createTestDatabase()
  users = new PrismaUserRepository(database.client)
  credentials = new PrismaCredentialRepository(database.client)
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

  it('turns a duplicate email into a domain error, on insert and on update', async () => {
    await users.add(buildUser({ email: 'a@example.com' }))
    const other = buildUser({ email: 'b@example.com' })
    await users.add(other)

    await expect(users.add(buildUser({ email: 'a@example.com' }))).rejects.toThrow(EmailAlreadyExistsError)
    await expect(users.update({ ...other, email: 'a@example.com' })).rejects.toThrow(EmailAlreadyExistsError)
  })

  it('rethrows other database errors untouched', async () => {
    await expect(users.update(buildUser())).rejects.not.toThrow(EmailAlreadyExistsError)
  })

  it('updates every mutable field', async () => {
    const user = buildUser()
    await users.add(user)

    const changed = {
      ...user,
      name: 'Bob',
      email: 'bob@example.com',
      status: 'banned' as const,
      subscription: 'yearly' as const,
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      deletedAt: new Date('2026-03-01T00:00:00.000Z')
    }
    await users.update(changed)

    expect(await users.findById(user.id)).toEqual(changed)
  })

  it('lists users with filters, ordering, pagination and the verification state of the email', async () => {
    const [a, b, c, deleted] = [
      buildUser({ createdAt: new Date('2026-01-01'), status: 'admin' }),
      buildUser({ createdAt: new Date('2026-01-02') }),
      buildUser({ createdAt: new Date('2026-01-03') }),
      buildUser({ createdAt: new Date('2026-01-04'), deletedAt: new Date() })
    ]
    for (const user of [c, a, b, deleted]) {
      await users.add(user)
    }
    await credentials.add(buildCredential(a.id, { emailVerified: true }))
    await credentials.add(buildCredential(b.id, { emailVerified: false }))

    const all = await users.list({ offset: 0, limit: 10 })
    expect(all.users.map((u) => [u.id, u.isEmailVerified])).toEqual([
      [a.id, true],
      [b.id, false],
      [c.id, false]
    ])
    expect(all.total).toBe(3)
    expect(await users.list({ offset: 1, limit: 1 })).toMatchObject({ users: [{ id: b.id }], total: 3 })
    expect((await users.list({ status: 'admin', offset: 0, limit: 10 })).users.map((u) => u.id)).toEqual([a.id])
    expect((await users.list({ isEmailVerified: false, offset: 0, limit: 10 })).users.map((u) => u.id)).toEqual([b.id])
    expect((await users.list({ email: c.email, offset: 0, limit: 10 })).users.map((u) => u.id)).toEqual([c.id])
  })

  it('finds a list item by id', async () => {
    const user = buildUser()
    await users.add(user)
    await credentials.add(buildCredential(user.id, { emailVerified: true }))

    expect(await users.findListItemById(user.id)).toEqual({ ...user, isEmailVerified: true })
    expect(await users.findListItemById('11111111-1111-4111-8111-111111111111')).toBeNull()
  })

  it('counts users by status without deleted ones and includes empty statuses', async () => {
    await users.add(buildUser({ status: 'admin' }))
    await users.add(buildUser({ status: 'user' }))
    await users.add(buildUser({ status: 'user' }))
    await users.add(buildUser({ status: 'user', deletedAt: new Date() }))

    expect(await users.countByStatus()).toEqual({ admin: 1, owner: 0, user: 2, unlimited: 0, banned: 0 })
  })
})
