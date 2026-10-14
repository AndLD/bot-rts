import type { ApiScope } from '../../../../lib/utils/interfaces/api-keys'
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

export interface Principal {
  user: User
  identity: Identity
  // Set when the caller used an API key instead of a session: what the key allows
  apiKey?: ApiKeyGrant
}

export class AuthService {
  constructor(
    private readonly verifier: IdentityVerifier,
    private readonly provisioner: UserProvisioner,
    private readonly cache?: PrincipalCache,
    private readonly apiKeys?: ApiKeyAuthenticator
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

    const principal = { user, identity }
    this.cache?.set(token, principal)

    return principal
  }
}
