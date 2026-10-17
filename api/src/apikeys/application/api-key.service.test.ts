import { createHash } from 'crypto'
import { ADMIN_API_KEY_LIMITS } from '../../../../lib/utils/admin-api-keys'
import { API_KEY_LIMITS } from '../../../../lib/utils/interfaces/api-keys'
import { FakeClock, InMemoryUserRepository, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import { UserBannedError } from '../../users/domain/user.errors'
import { ApiKey } from '../domain/api-key'
import {
  ApiKeyScopeError,
  SessionOnlyError,
  TooManyAdminApiKeysError,
  TooManyApiKeysError
} from '../domain/api-key.errors'
import { ApiKeyRepository } from './api-key.repository'
import { ApiKeyService } from './api-key.service'
import { KeySecrets } from './key-secrets'

class InMemoryApiKeys implements ApiKeyRepository {
  items: ApiKey[] = []
  touches: string[] = []
  async add(key: ApiKey) {
    this.items.push(key)
  }
  async findByHash(hash: string) {
    return this.items.find((key) => key.keyHash === hash) ?? null
  }
  async findById(id: string) {
    return this.items.find((key) => key.id === id) ?? null
  }
  async findOfUser(userId: string, id: string) {
    return this.items.find((key) => key.id === id && key.userId === userId && !key.adminGrant) ?? null
  }
  async listOfUser(userId: string) {
    return this.items.filter((key) => key.userId === userId && !key.adminGrant).reverse()
  }
  async listAdminKeys() {
    return this.items.filter((key) => key.adminGrant).reverse()
  }
  async countActiveOfUser(userId: string, now: Date) {
    return this.items.filter(
      (key) => key.userId === userId && !key.adminGrant && !key.revokedAt && (!key.expiresAt || key.expiresAt > now)
    ).length
  }
  async countActiveAdminKeysOfUser(userId: string, now: Date) {
    return this.items.filter(
      (key) => key.userId === userId && key.adminGrant && !key.revokedAt && (!key.expiresAt || key.expiresAt > now)
    ).length
  }
  async revoke(id: string, at: Date) {
    this.items = this.items.map((key) => (key.id === id ? { ...key, revokedAt: at } : key))
  }
  async touch(id: string, at: Date) {
    this.touches.push(id)
    this.items = this.items.map((key) => (key.id === id ? { ...key, lastUsedAt: at } : key))
  }
}

class CountingSecrets implements KeySecrets {
  private n = 0
  generate() {
    this.n += 1
    return `botrts_secret${String(this.n).padStart(6, '0')}`
  }
  hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex')
  }
}

const DAY = 24 * 3600 * 1000

async function setup() {
  const keys = new InMemoryApiKeys()
  const users = new InMemoryUserRepository()
  const clock = new FakeClock()
  const alice = buildUser({ id: '11111111-1111-4111-8111-111111111111' })
  const bob = buildUser({ id: '22222222-2222-4222-8222-222222222222' })
  const admin = buildUser({ id: '33333333-3333-4333-8333-333333333333', status: 'admin' })
  const moderator = buildUser({ id: '44444444-4444-4444-8444-444444444444', status: 'moderator' })
  await users.add(alice)
  await users.add(bob)
  await users.add(admin)
  await users.add(moderator)
  const service = new ApiKeyService(keys, users, new CountingSecrets(), new SequentialIdGenerator(), clock, 30)
  return { keys, users, clock, alice, bob, admin, moderator, service }
}

describe('ApiKeyService: creating keys', () => {
  it('returns the secret once and stores only its hash, with a prefix to tell keys apart', async () => {
    const { service, keys, alice } = await setup()

    const { key, secret } = await service.create(alice.id, { name: '  Dashboard ', scopes: ['read', 'read', 'files'] })

    expect(secret).toBe('botrts_secret000001')
    expect(key).toMatchObject({
      name: 'Dashboard',
      prefix: 'botrts_secr',
      scopes: ['read', 'files'],
      ratePerMinute: API_KEY_LIMITS.defaultRatePerMinute,
      expiresAt: null,
      revokedAt: null
    })
    expect(JSON.stringify(keys.items)).not.toContain(secret)
    expect(keys.items[0].keyHash).toBe(createHash('sha256').update(secret).digest('hex'))
  })

  it('takes a rate limit and an expiry', async () => {
    const { service, alice, clock } = await setup()

    const { key } = await service.create(alice.id, { name: 'k', scopes: ['read'], ratePerMinute: 30, expiresInDays: 2 })

    expect(key.ratePerMinute).toBe(30)
    expect(key.expiresAt).toEqual(new Date(clock.now().getTime() + 2 * DAY))
  })

  it('refuses a key without a name or without scopes', async () => {
    const { service, alice } = await setup()

    await expect(service.create(alice.id, { name: '   ', scopes: ['read'] })).rejects.toBeInstanceOf(ValidationError)
    await expect(service.create(alice.id, { name: 'k', scopes: [] })).rejects.toBeInstanceOf(ValidationError)
  })

  it('holds a player to a number of active keys, a revoked or expired one not counting', async () => {
    const { service, alice, bob, clock } = await setup()
    const created = []
    for (let n = 0; n < API_KEY_LIMITS.maxKeysPerPlayer - 1; n++) {
      created.push(await service.create(alice.id, { name: `k${n}`, scopes: ['read'] }))
    }
    await service.create(alice.id, { name: 'short', scopes: ['read'], expiresInDays: 1 })
    await expect(service.create(alice.id, { name: 'one too many', scopes: ['read'] })).rejects.toBeInstanceOf(
      TooManyApiKeysError
    )
    await expect(service.create(bob.id, { name: 'bob', scopes: ['read'] })).resolves.toBeDefined()

    await service.revoke(alice.id, created[0].key.id)
    await expect(service.create(alice.id, { name: 'room again', scopes: ['read'] })).resolves.toBeDefined()
    clock.current = new Date(clock.now().getTime() + 2 * DAY)
    await expect(service.create(alice.id, { name: 'room after expiry', scopes: ['read'] })).resolves.toBeDefined()
  })
})

describe('ApiKeyService: listing and revoking', () => {
  it('lists the keys of the player only, newest first', async () => {
    const { service, alice, bob } = await setup()
    await service.create(alice.id, { name: 'first', scopes: ['read'] })
    await service.create(alice.id, { name: 'second', scopes: ['read'] })
    await service.create(bob.id, { name: 'bobs', scopes: ['read'] })

    expect((await service.list(alice.id)).map((key) => key.name)).toEqual(['second', 'first'])
  })

  it('revokes a key, accepts a second revocation, and does not know the key of another player', async () => {
    const { service, alice, bob, clock } = await setup()
    const { key } = await service.create(alice.id, { name: 'k', scopes: ['read'] })

    const revoked = await service.revoke(alice.id, key.id)
    clock.current = new Date(clock.now().getTime() + 1000)
    const again = await service.revoke(alice.id, key.id)

    expect(revoked.revokedAt).not.toBeNull()
    expect(again.revokedAt).toEqual(revoked.revokedAt)
    await expect(service.revoke(bob.id, key.id)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ApiKeyService: revoking as an admin', () => {
  it('ends the key of any player, accepts a second revocation, and does not know a key that is not there', async () => {
    const { service, alice } = await setup()
    const { key } = await service.create(alice.id, { name: 'k', scopes: ['read'] })

    const revoked = await service.revokeAsAdmin(key.id)
    const again = await service.revokeAsAdmin(key.id)

    expect(revoked.revokedAt).not.toBeNull()
    expect(again.revokedAt).toEqual(revoked.revokedAt)
    await expect(service.revokeAsAdmin('missing')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ApiKeyService: authenticating a key', () => {
  it('is the player, with the grant of the key, and counts the use once in a while', async () => {
    const { service, alice, keys, clock } = await setup()
    const { key, secret } = await service.create(alice.id, {
      name: 'k',
      scopes: ['read', 'movement'],
      ratePerMinute: 9
    })

    const principal = await service.authenticate(secret)

    expect(principal.user.id).toBe(alice.id)
    expect(principal.apiKey).toEqual({ id: key.id, scopes: ['read', 'movement'], ratePerMinute: 9 })
    expect(principal.identity).toMatchObject({ provider: 'api-key', subject: alice.id })
    await service.authenticate(secret)
    expect(keys.touches).toEqual([key.id])
    clock.current = new Date(clock.now().getTime() + 6 * 60 * 1000)
    await service.authenticate(secret)
    expect(keys.touches).toEqual([key.id, key.id])
  })

  it.each([
    ['an unknown key', async () => 'botrts_nothing'],
    [
      'a revoked key',
      async ({ service, alice }: Awaited<ReturnType<typeof setup>>) => {
        const { key, secret } = await service.create(alice.id, { name: 'k', scopes: ['read'] })
        await service.revoke(alice.id, key.id)
        return secret
      }
    ],
    [
      'an expired key',
      async ({ service, alice, clock }: Awaited<ReturnType<typeof setup>>) => {
        const { secret } = await service.create(alice.id, { name: 'k', scopes: ['read'], expiresInDays: 1 })
        clock.current = new Date(clock.now().getTime() + 2 * DAY)
        return secret
      }
    ],
    [
      'the key of a player who is gone',
      async ({ service, alice, users }: Awaited<ReturnType<typeof setup>>) => {
        const { secret } = await service.create(alice.id, { name: 'k', scopes: ['read'] })
        users.items.delete(alice.id)
        return secret
      }
    ]
  ])('refuses %s', async (_name, prepare) => {
    const world = await setup()
    const secret = await prepare(world as never)

    await expect(world.service.authenticate(secret)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('refuses the key of a banned player, like a session', async () => {
    const { service, alice, users } = await setup()
    const { secret } = await service.create(alice.id, { name: 'k', scopes: ['read'] })
    await users.update({ ...alice, status: 'banned' })

    await expect(service.authenticate(secret)).rejects.toBeInstanceOf(UserBannedError)
  })
})

describe('the errors of keys', () => {
  it('say what is missing', () => {
    expect(new ApiKeyScopeError('files')).toMatchObject({ statusCode: 403, code: 'API_KEY_SCOPE' })
    expect(new SessionOnlyError()).toMatchObject({ statusCode: 403, code: 'SESSION_ONLY' })
  })
})

describe('ApiKeyService: admin keys (design §25.2)', () => {
  const input = {
    name: ' Assistant ',
    scopes: ['admin:logs:read', 'admin:logs:read', 'admin:audit:read'] as const,
    reason: ' investigating a slow tick ',
    expiresInDays: 7
  }
  const create = (world: Awaited<ReturnType<typeof setup>>, overrides = {}) =>
    world.service.createAdminKey(world.admin, { ...input, scopes: [...input.scopes], ...overrides })

  it('creates a read-only key for the admin with a reason, an expiry and the default rate', async () => {
    const world = await setup()

    const { key, secret } = await create(world, { ipAllowList: [' 10.0.0.1 ', '10.0.0.1'] })

    expect(secret).toBe('botrts_secret000001')
    expect(key).toMatchObject({
      userId: world.admin.id,
      name: 'Assistant',
      scopes: ['admin:logs:read', 'admin:audit:read'],
      ratePerMinute: ADMIN_API_KEY_LIMITS.defaultRatePerMinute,
      expiresAt: new Date(world.clock.now().getTime() + 7 * DAY),
      adminGrant: { reason: 'investigating a slow tick', ipAllowList: ['10.0.0.1'] }
    })
    expect(JSON.stringify(world.keys.items)).not.toContain(secret)
    await expect(create(world, { ratePerMinute: 5 })).resolves.toMatchObject({ key: { ratePerMinute: 5 } })
  })

  it('is for an admin role only, and never for a scope the role does not include', async () => {
    const world = await setup()

    await expect(
      world.service.createAdminKey(world.alice, { ...input, scopes: ['admin:logs:read'] })
    ).rejects.toMatchObject({
      statusCode: 403
    })
    await expect(
      world.service.createAdminKey(world.moderator, { ...input, scopes: ['admin:audit:read'] })
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      world.service.createAdminKey(world.moderator, { ...input, scopes: ['admin:health:read'] })
    ).resolves.toBeDefined()
  })

  it.each([
    ['a blank name', { name: '  ' }],
    ['no reason', { reason: ' a ' }],
    ['no scope', { scopes: [] }],
    ['a player scope', { scopes: ['read'] }],
    ['a lifetime of zero days', { expiresInDays: 0 }],
    ['a lifetime beyond the setting', { expiresInDays: 31 }],
    ['a lifetime that is not a whole number', { expiresInDays: 1.5 }],
    ['an empty address', { ipAllowList: [' '] }],
    ['too many addresses', { ipAllowList: Array.from({ length: 11 }, (_, n) => `10.0.0.${n}`) }]
  ])('refuses %s', async (_name, overrides) => {
    const world = await setup()

    await expect(create(world, overrides)).rejects.toBeInstanceOf(ValidationError)
  })

  it('holds an admin to a number of active admin keys, a revoked one not counting', async () => {
    const world = await setup()
    const created = []
    for (let n = 0; n < ADMIN_API_KEY_LIMITS.maxKeysPerAdmin; n++) {
      created.push(await create(world))
    }

    await expect(create(world)).rejects.toBeInstanceOf(TooManyAdminApiKeysError)
    await world.service.revokeAdminKey(created[0].key.id)
    await expect(create(world)).resolves.toBeDefined()
  })

  it('keeps admin keys out of the list of the player, out of its revocation, and out of its count', async () => {
    const world = await setup()
    const { key } = await create(world)
    await world.service.create(world.admin.id, { name: 'mine', scopes: ['read'] })

    expect((await world.service.list(world.admin.id)).map((item) => item.name)).toEqual(['mine'])
    await expect(world.service.revoke(world.admin.id, key.id)).rejects.toMatchObject({ statusCode: 404 })
    expect((await world.service.listAdminKeys()).map((item) => item.id)).toEqual([key.id])
  })

  it('refuses an admin scope on a player key, whatever the transport let through', async () => {
    const { service, alice } = await setup()

    await expect(
      service.create(alice.id, { name: 'k', scopes: ['read', 'admin:logs:read' as never] })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('revokes an admin key from the console, once, and does not know a player key there', async () => {
    const world = await setup()
    const { key } = await create(world)
    const player = await world.service.create(world.alice.id, { name: 'k', scopes: ['read'] })

    const revoked = await world.service.revokeAdminKey(key.id)

    expect(revoked.revokedAt).not.toBeNull()
    await expect(world.service.revokeAdminKey(player.key.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(world.service.revokeAdminKey('missing')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('authenticates as the admin with the addresses of the key, and stops at once when the owner is demoted or banned', async () => {
    const world = await setup()
    const { key, secret } = await create(world, { ipAllowList: ['10.0.0.1'] })

    const principal = await world.service.authenticate(secret)
    expect(principal.user.id).toBe(world.admin.id)
    expect(principal.apiKey).toEqual({
      id: key.id,
      scopes: ['admin:logs:read', 'admin:audit:read'],
      ratePerMinute: ADMIN_API_KEY_LIMITS.defaultRatePerMinute,
      ipAllowList: ['10.0.0.1']
    })

    await world.users.update({ ...world.admin, status: 'user' })
    await expect(world.service.authenticate(secret)).rejects.toBeInstanceOf(UnauthorizedError)
    await world.users.update({ ...world.admin, status: 'banned' })
    await expect(world.service.authenticate(secret)).rejects.toBeInstanceOf(UserBannedError)
  })

  it('hands an admin key back by its id, and does not know a player key or a missing one', async () => {
    const world = await setup()
    const { key } = await create(world)
    const player = await world.service.create(world.alice.id, { name: 'k', scopes: ['read'] })

    await expect(world.service.getAdminKey(key.id)).resolves.toMatchObject({ id: key.id })
    await expect(world.service.getAdminKey(player.key.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(world.service.getAdminKey('missing')).rejects.toMatchObject({ statusCode: 404 })
  })
})
