import { randomUUID } from 'crypto'
import { buildAuthToken, buildCredential, buildSession, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaAuthTokenRepository } from './prisma-auth-token.repository'
import { PrismaCredentialRepository } from './prisma-credential.repository'
import { PrismaIdentityRepository } from './prisma-identity.repository'
import { PrismaSessionRepository } from './prisma-session.repository'

let database: TestDatabase
let userId: string

const identities = () => new PrismaIdentityRepository(database.client)
const credentials = () => new PrismaCredentialRepository(database.client)
const sessions = () => new PrismaSessionRepository(database.client)
const tokens = () => new PrismaAuthTokenRepository(database.client)

beforeAll(async () => {
  database = await createTestDatabase()
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  userId = user.id
})
afterAll(() => database.drop())

describe('PrismaIdentityRepository', () => {
  it('links an identity to a user, once per provider and subject', async () => {
    const link = { id: randomUUID(), provider: 'local', subject: userId, userId, createdAt: new Date('2026-01-01') }

    await identities().add(link)

    expect(await identities().findByIdentity('local', userId)).toEqual(link)
    expect(await identities().findByIdentity('other', userId)).toBeNull()
    await expect(identities().add({ ...link, id: randomUUID() })).rejects.toThrow()
  })

  it('deletes the links of a user', async () => {
    await identities().add({ id: randomUUID(), provider: 'local', subject: userId, userId, createdAt: new Date() })

    await identities().deleteByUserId(userId)

    expect(await identities().findByIdentity('local', userId)).toBeNull()
  })
})

describe('PrismaCredentialRepository', () => {
  it('stores, updates and deletes the credential of a user', async () => {
    const credential = buildCredential(userId, { emailVerified: false })
    await credentials().add(credential)
    expect(await credentials().findByUserId(userId)).toEqual(credential)

    const changed = { ...credential, passwordHash: 'new', emailVerified: true, updatedAt: new Date('2026-02-01') }
    await credentials().update(changed)
    expect(await credentials().findByUserId(userId)).toEqual(changed)

    await credentials().deleteByUserId(userId)
    expect(await credentials().findByUserId(userId)).toBeNull()
  })
})

describe('PrismaSessionRepository', () => {
  it('finds sessions by id and by refresh token hash and updates them', async () => {
    const session = buildSession(userId, { refreshTokenHash: 'abc' })
    await sessions().add(session)

    expect(await sessions().findById(session.id)).toEqual(session)
    expect(await sessions().findByRefreshTokenHash('abc')).toEqual(session)
    expect(await sessions().findByRefreshTokenHash('zzz')).toBeNull()

    const rotated = {
      ...session,
      refreshTokenHash: 'def',
      lastUsedAt: new Date('2026-01-05'),
      revokedAt: new Date('2026-01-06')
    }
    await sessions().update(rotated)
    expect(await sessions().findByRefreshTokenHash('def')).toEqual(rotated)
  })

  it('revokes every active session of a user except one', async () => {
    const [keep, other, revoked] = [
      buildSession(userId),
      buildSession(userId),
      buildSession(userId, { revokedAt: new Date('2026-01-02') })
    ]
    for (const session of [keep, other, revoked]) {
      await sessions().add(session)
    }
    const now = new Date('2026-01-10')

    await sessions().revokeAllOfUser(userId, now, keep.id)

    expect((await sessions().findById(keep.id))?.revokedAt).toBeNull()
    expect((await sessions().findById(other.id))?.revokedAt).toEqual(now)
    expect((await sessions().findById(revoked.id))?.revokedAt).toEqual(new Date('2026-01-02'))

    await sessions().revokeAllOfUser(userId, now)
    expect((await sessions().findById(keep.id))?.revokedAt).toEqual(now)
  })

  it('deletes the sessions of a user', async () => {
    const session = buildSession(userId)
    await sessions().add(session)

    await sessions().deleteByUserId(userId)

    expect(await sessions().findById(session.id)).toBeNull()
  })
})

describe('PrismaAuthTokenRepository', () => {
  it('stores a token and finds it by hash; the hash is unique', async () => {
    const token = buildAuthToken(userId, { tokenHash: 'h1', kind: 'email_change', newEmail: 'new@example.com' })
    await tokens().add(token)

    expect(await tokens().findByHash('h1')).toEqual(token)
    expect(await tokens().findByHash('zzz')).toBeNull()
    await expect(tokens().add(buildAuthToken(userId, { tokenHash: 'h1' }))).rejects.toThrow()
  })

  it('marks a token as used', async () => {
    const token = buildAuthToken(userId, { tokenHash: 'h2' })
    await tokens().add(token)
    const now = new Date('2026-01-01T10:00:00Z')

    await tokens().markUsed(token.id, now)

    expect((await tokens().findByHash('h2'))?.usedAt).toEqual(now)
  })

  it('expires only the pending tokens of the same kind and user', async () => {
    const now = new Date('2026-01-01T10:00:00Z')
    const pending = buildAuthToken(userId, { tokenHash: 'p', expiresAt: new Date('2026-01-03') })
    const otherKind = buildAuthToken(userId, {
      tokenHash: 'o',
      kind: 'password_reset',
      expiresAt: new Date('2026-01-03')
    })
    const used = buildAuthToken(userId, {
      tokenHash: 'u',
      usedAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-01-03')
    })
    for (const token of [pending, otherKind, used]) {
      await tokens().add(token)
    }

    await tokens().expirePending(userId, 'email_verification', now)

    expect((await tokens().findByHash('p'))?.expiresAt).toEqual(now)
    expect((await tokens().findByHash('o'))?.expiresAt).toEqual(new Date('2026-01-03'))
    expect((await tokens().findByHash('u'))?.expiresAt).toEqual(new Date('2026-01-03'))
  })

  it('deletes the tokens of a user', async () => {
    await tokens().add(buildAuthToken(userId, { tokenHash: 'd' }))

    await tokens().deleteByUserId(userId)

    expect(await tokens().findByHash('d')).toBeNull()
  })
})
