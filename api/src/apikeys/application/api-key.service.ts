import { isAdminRole, hasPermission } from '../../../../lib/utils/admin'
import {
  ADMIN_API_KEY_LIMITS,
  ADMIN_SCOPE_PERMISSION,
  isAdminApiScope,
  ICreateAdminApiKey
} from '../../../../lib/utils/admin-api-keys'
import {
  API_KEY_LIMITS,
  API_KEY_PREFIX,
  API_SCOPES,
  ApiScope,
  ICreateApiKey
} from '../../../../lib/utils/interfaces/api-keys'
import { ApiKeyAuthenticator } from '../../auth/application/api-key-authenticator'
import { Principal } from '../../auth/application/auth.service'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { User } from '../../users/domain/user.entity'
import { assertCanUseApi } from '../../users/domain/user-access'
import { ApiKey, isKeyUsable } from '../domain/api-key'
import { TooManyAdminApiKeysError, TooManyApiKeysError } from '../domain/api-key.errors'
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
    private readonly clock: Clock,
    // The longest an admin key may live, in days (`ADMIN_API_KEY_MAX_DAYS`)
    private readonly adminKeyMaxDays: number
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
    // A player can never name an admin scope, whatever the transport validation let through
    if (!scopes.every((scope) => (API_SCOPES as readonly string[]).includes(scope))) {
      throw new ValidationError('Unknown scope')
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
      revokedAt: null,
      adminGrant: null
    }
    await this.keys.add(key)

    return { key, secret }
  }

  // Creates a read-only key with admin scopes for the admin who is signed in to the console (design §25.2). The caller has passed the
  // second factor; the key does not need it, so it always expires and stops at once when its owner loses the role.
  async createAdminKey(admin: User, input: ICreateAdminApiKey): Promise<{ key: ApiKey; secret: string }> {
    const now = this.clock.now()
    const name = input.name.trim()
    const reason = input.reason.trim()
    const scopes = [...new Set(input.scopes)]
    const ipAllowList = [...new Set((input.ipAllowList ?? []).map((ip) => ip.trim()))]

    if (!isAdminRole(admin.status)) {
      throw new ForbiddenError()
    }
    if (!name) {
      throw new ValidationError('A key needs a name')
    }
    if (reason.length < ADMIN_API_KEY_LIMITS.reasonMinLength) {
      throw new ValidationError('An admin key needs a reason')
    }
    if (!scopes.length || !scopes.every(isAdminApiScope)) {
      throw new ValidationError('An admin key needs at least one admin scope')
    }
    // The key can never do what its owner's role cannot
    if (!scopes.every((scope) => hasPermission(admin.status, ADMIN_SCOPE_PERMISSION[scope]))) {
      throw new ForbiddenError()
    }
    if (
      !Number.isInteger(input.expiresInDays) ||
      input.expiresInDays < 1 ||
      input.expiresInDays > this.adminKeyMaxDays
    ) {
      throw new ValidationError(`An admin key lives 1 to ${this.adminKeyMaxDays} days`)
    }
    if (ipAllowList.some((ip) => !ip) || ipAllowList.length > ADMIN_API_KEY_LIMITS.maxIpAllowList) {
      throw new ValidationError('The address list is not valid')
    }
    if ((await this.keys.countActiveAdminKeysOfUser(admin.id, now)) >= ADMIN_API_KEY_LIMITS.maxKeysPerAdmin) {
      throw new TooManyAdminApiKeysError()
    }

    const secret = this.secrets.generate()
    const key: ApiKey = {
      id: this.ids.next(),
      userId: admin.id,
      name,
      prefix: secret.slice(0, PREFIX_LENGTH),
      keyHash: this.secrets.hash(secret),
      scopes,
      ratePerMinute: input.ratePerMinute ?? ADMIN_API_KEY_LIMITS.defaultRatePerMinute,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
      revokedAt: null,
      adminGrant: { reason, ipAllowList }
    }
    await this.keys.add(key)

    return { key, secret }
  }

  listAdminKeys(): Promise<ApiKey[]> {
    return this.keys.listAdminKeys()
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

  // Ends an admin key from the console; a player key is not found here, the Security page revokes those
  async revokeAdminKey(id: string): Promise<ApiKey> {
    const key = await this.keys.findById(id)

    if (!key?.adminGrant) {
      throw new NotFoundError('API key not found')
    }

    return this.revokeAsAdmin(id)
  }

  // An admin ends a key whoever owns it (design §25.3, Security); ending an ended key is not an error
  async revokeAsAdmin(id: string): Promise<ApiKey> {
    const key = await this.keys.findById(id)

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
    // An admin key is only as good as its owner's role: once the owner is not an admin, the key is not a key any more
    if (key.adminGrant && !isAdminRole(user.status)) {
      throw new UnauthorizedError('The API key is not valid')
    }

    if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await this.keys.touch(key.id, now)
    }

    return {
      user,
      identity: { provider: API_PROVIDER, subject: user.id, email: user.email, emailVerified: true },
      apiKey: {
        id: key.id,
        scopes: key.scopes,
        ratePerMinute: key.ratePerMinute,
        ...(key.adminGrant && { ipAllowList: key.adminGrant.ipAllowList })
      }
    }
  }
}
