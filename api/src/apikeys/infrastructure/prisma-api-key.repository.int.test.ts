import { randomUUID } from 'crypto'
import { buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { ApiKey } from '../domain/api-key'
import { PrismaApiKeyRepository } from './prisma-api-key.repository'

let database: TestDatabase
let repository: PrismaApiKeyRepository
let userId: string

const at = (day: number) => new Date(Date.UTC(2026, 5, day))

const buildKey = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: randomUUID(),
  userId,
  name: 'k',
  prefix: 'botrts_abcd',
  keyHash: `hash-${randomUUID()}`,
  scopes: ['read', 'movement'],
  ratePerMinute: 120,
  createdAt: at(1),
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  adminGrant: null,
  ...overrides
})

beforeAll(async () => {
  database = await createTestDatabase()
  repository = new PrismaApiKeyRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  userId = user.id
})
afterAll(() => database.drop())

describe('PrismaApiKeyRepository', () => {
  it('stores a key with its scopes and finds it by its hash, never by anything else', async () => {
    const key = buildKey()
    await repository.add(key)

    expect(await repository.findByHash(key.keyHash)).toEqual(key)
    expect(await repository.findByHash('other')).toBeNull()
  })

  it('refuses two keys with the same hash', async () => {
    const key = buildKey()
    await repository.add(key)

    await expect(repository.add(buildKey({ keyHash: key.keyHash }))).rejects.toThrow()
  })

  it('finds a key of a player and lists them newest first', async () => {
    const older = buildKey({ createdAt: at(1) })
    const newer = buildKey({ createdAt: at(2) })
    await repository.add(older)
    await repository.add(newer)
    const other = buildUser()
    await new PrismaUserRepository(database.client).add(other)

    expect((await repository.listOfUser(userId)).map((key) => key.id)).toEqual([newer.id, older.id])
    expect(await repository.listOfUser(other.id)).toEqual([])
    expect(await repository.findOfUser(userId, older.id)).toEqual(older)
    expect(await repository.findOfUser(other.id, older.id)).toBeNull()
  })

  it('revokes and touches a key, and counts only the keys that are neither revoked nor expired', async () => {
    const live = buildKey()
    const revoked = buildKey()
    const expired = buildKey({ expiresAt: at(3) })
    const later = buildKey({ expiresAt: at(20) })
    for (const key of [live, revoked, expired, later]) await repository.add(key)

    await repository.revoke(revoked.id, at(5))
    await repository.touch(live.id, at(6))

    expect(await repository.countActiveOfUser(userId, at(10))).toBe(2)
    expect((await repository.findOfUser(userId, revoked.id))?.revokedAt).toEqual(at(5))
    expect((await repository.findOfUser(userId, live.id))?.lastUsedAt).toEqual(at(6))
  })

  describe('admin keys', () => {
    const admin = (overrides: Partial<ApiKey> = {}) =>
      buildKey({
        scopes: ['admin:logs:read'],
        expiresAt: at(20),
        adminGrant: { reason: 'investigating', ipAllowList: ['10.0.0.1'] },
        ...overrides
      })

    it('keeps the reason and the addresses, and tells an admin key from a player key', async () => {
      const key = admin()
      await repository.add(key)
      await repository.add(buildKey())

      expect(await repository.findById(key.id)).toEqual(key)
      expect((await repository.listAdminKeys()).map((item) => item.id)).toEqual([key.id])
    })

    it('hides them from the player: list, find and count', async () => {
      const key = admin()
      await repository.add(key)

      expect(await repository.listOfUser(userId)).toEqual([])
      expect(await repository.findOfUser(userId, key.id)).toBeNull()
      expect(await repository.countActiveOfUser(userId, at(2))).toBe(0)
      expect(await repository.countActiveAdminKeysOfUser(userId, at(2))).toBe(1)
      expect(await repository.countActiveAdminKeysOfUser(userId, at(25))).toBe(0)
    })

    it('lists the newest first, revoked ones included', async () => {
      const old = admin({ createdAt: at(1) })
      const recent = admin({ createdAt: at(2), revokedAt: at(3) })
      await repository.add(old)
      await repository.add(recent)

      expect((await repository.listAdminKeys()).map((item) => item.id)).toEqual([recent.id, old.id])
      expect(await repository.countActiveAdminKeysOfUser(userId, at(4))).toBe(1)
    })
  })
})
