import { hasPermission } from '../../../../lib/utils/admin'
import type { UserStatus } from '../../../../lib/utils/interfaces/users'
import type { ApiScope } from '../../../../lib/utils/interfaces/api-keys'
import { assertOutranks } from '../../players/domain/player-moderation'
import { UnauthorizedError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { User } from '../../users/domain/user.entity'
import { assertCanUseApi } from '../../users/domain/user-access'
import { Identity } from '../domain/identity'
import { ApiKeyAuthenticator, looksLikeApiKey } from './api-key-authenticator'
import { IdentityVerifier } from './identity-verifier'
import type { PrincipalCache } from './principal-cache'
import { UserProvisioner } from './user-provisioner'

// Who is calling and may they use the API; roles and bans are always read from our store, never from the token
export interface ApiKeyGrant {
  id: string
  scopes: readonly ApiScope[]
  ratePerMinute: number
}

// Who is really behind a "view as player" session (design §25.2): `Principal.user` is the player being viewed
export interface ViewAsGrant {
  adminId: string
  adminStatus: UserStatus
  reason: string
  expiresAt: Date
}

export interface Principal {
  // The caller; in a "view as player" session, the player whose game is shown
  user: User
  identity: Identity
  // Set when the caller used an API key instead of a session: what the key allows
  apiKey?: ApiKeyGrant
  // Set when the session is a read-only view of `user`'s game by an admin
  viewAs?: ViewAsGrant
}

export class AuthService {
  constructor(
    private readonly verifier: IdentityVerifier,
    private readonly provisioner: UserProvisioner,
    private readonly cache?: PrincipalCache,
    private readonly apiKeys?: ApiKeyAuthenticator,
    private readonly users?: Pick<UserRepository, 'findById'>
  ) {}

  async authenticate(token: string): Promise<Principal> {
    const cached = this.cache?.get(token)

    if (cached) {
      return cached
    }

    if (this.apiKeys && looksLikeApiKey(token)) {
      // Not cached: a revoked key must stop working at once, and its use is counted per key
      return this.apiKeys.authenticate(token)
    }

    const identity = await this.verifier.verify(token)
    const user = await this.provisioner.ensureUser(identity)

    assertCanUseApi(user, identity.emailVerified)

    const principal = identity.viewAs ? await this.viewAsPrincipal(user, identity) : { user, identity }
    this.cache?.set(token, principal)

    return principal
  }

  // The admin keeps the permission and the rank over the player for as long as the view lasts: a demotion ends it at once
  private async viewAsPrincipal(admin: User, identity: Identity): Promise<Principal> {
    const view = identity.viewAs as NonNullable<Identity['viewAs']>
    const target = await this.users?.findById(view.userId)

    if (!target || !hasPermission(admin.status, 'players.view-as')) {
      throw new UnauthorizedError('The view has ended')
    }
    try {
      assertOutranks(admin, target)
    } catch {
      throw new UnauthorizedError('The view has ended')
    }

    return {
      user: target,
      identity,
      viewAs: { adminId: admin.id, adminStatus: admin.status, reason: view.reason, expiresAt: view.expiresAt }
    }
  }
}
