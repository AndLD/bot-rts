import { API_KEY_LIMITS, API_KEY_PREFIX, ApiScope, ICreateApiKey } from '../../../../lib/utils/interfaces/api-keys'
import { ApiKeyAuthenticator } from '../../auth/application/api-key-authenticator'
import { Principal } from '../../auth/application/auth.service'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { assertCanUseApi } from '../../users/domain/user-access'
import { ApiKey, isKeyUsable } from '../domain/api-key'
import { TooManyApiKeysError } from '../domain/api-key.errors'
import { ApiKeyRepository } from './api-key.repository'
import { KeySecrets } from './key-secrets'

const DAY_MS = 24 * 3600 * 1000
// The last use is written at most this often: a key used in a burst should not write on every request
const TOUCH_EVERY_MS = 5 * 60 * 1000
const PREFIX_LENGTH = API_KEY_PREFIX.length + 4

export const API_PROVIDER = 'api-key'

export class ApiKeyService implements ApiKeyAuthenticator {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly users: UserRepository,
    private readonly secrets: KeySecrets,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  // Creates a key; the secret is returned here and never again
  async create(userId: string, input: ICreateApiKey): Promise<{ key: ApiKey; secret: string }> {
    const now = this.clock.now()
    const name = input.name.trim()
    const scopes = [...new Set(input.scopes)] as ApiScope[]

    if (!name) {
      throw new ValidationError('A key needs a name')
    }
    if (!scopes.length) {
      throw new ValidationError('A key needs at least one scope')
    }
    if ((await this.keys.countActiveOfUser(userId, now)) >= API_KEY_LIMITS.maxKeysPerPlayer) {
      throw new TooManyApiKeysError()
    }

    const secret = this.secrets.generate()
    const key: ApiKey = {
      id: this.ids.next(),
      userId,
      name,
      prefix: secret.slice(0, PREFIX_LENGTH),
      keyHash: this.secrets.hash(secret),
      scopes,
      ratePerMinute: input.ratePerMinute ?? API_KEY_LIMITS.defaultRatePerMinute,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: input.expiresInDays ? new Date(now.getTime() + input.expiresInDays * DAY_MS) : null,
      revokedAt: null
    }
    await this.keys.add(key)

    return { key, secret }
  }

  list(userId: string): Promise<ApiKey[]> {
    return this.keys.listOfUser(userId)
  }

  // Revoking a revoked key is not an error; a key of another player does not exist
  async revoke(userId: string, id: string): Promise<ApiKey> {
    const key = await this.keys.findOfUser(userId, id)

    if (!key) {
      throw new NotFoundError('API key not found')
    }
    if (key.revokedAt) {
      return key
    }

    const at = this.clock.now()
    await this.keys.revoke(id, at)

    return { ...key, revokedAt: at }
  }

  // An admin ends a key whoever owns it (design §25.3, Security); ending an ended key is not an error
  async revokeAsAdmin(id: string): Promise<ApiKey> {
    const key = await this.keys.findById(id)

    if (!key) {
      throw new NotFoundError('API key not found')
    }

    return key.revokedAt ? key : this.revoke(key.userId, id)
  }

  // Who the key is: its player, checked against our store like for a session (bans, deleted accounts), with the key's grant
  async authenticate(secret: string): Promise<Principal> {
    const key = await this.keys.findByHash(this.secrets.hash(secret))
    const now = this.clock.now()

    if (!key || !isKeyUsable(key, now)) {
      throw new UnauthorizedError('The API key is not valid')
    }

    const user = await this.users.findById(key.userId)
    if (!user) {
      throw new UnauthorizedError('The API key is not valid')
    }
    assertCanUseApi(user, true)

    if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await this.keys.touch(key.id, now)
    }

    return {
      user,
      identity: { provider: API_PROVIDER, subject: user.id, email: user.email, emailVerified: true },
      apiKey: { id: key.id, scopes: key.scopes, ratePerMinute: key.ratePerMinute }
    }
  }
}
