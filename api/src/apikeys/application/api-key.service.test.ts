import { createHash } from 'crypto'
import { API_KEY_LIMITS } from '../../../../lib/utils/interfaces/api-keys'
import { FakeClock, InMemoryUserRepository, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import { UserBannedError } from '../../users/domain/user.errors'
import { ApiKey } from '../domain/api-key'
import { ApiKeyScopeError, SessionOnlyError, TooManyApiKeysError } from '../domain/api-key.errors'
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
  async findOfUser(userId: string, id: string) {
    return this.items.find((key) => key.id === id && key.userId === userId) ?? null
  }
  async listOfUser(userId: string) {
    return this.items.filter((key) => key.userId === userId).reverse()
  }
  async countActiveOfUser(userId: string, now: Date) {
    return this.items.filter(
      (key) => key.userId === userId && !key.revokedAt && (!key.expiresAt || key.expiresAt > now)
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
  await users.add(alice)
  await users.add(bob)
  const service = new ApiKeyService(keys, users, new CountingSecrets(), new SequentialIdGenerator(), clock)
  return { keys, users, clock, alice, bob, service }
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
