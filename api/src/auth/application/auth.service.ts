import { User } from '../../users/domain/user.entity'
import { assertCanUseApi } from '../../users/domain/user-access'
import { Identity } from '../domain/identity'
import { IdentityVerifier } from './identity-verifier'
import type { PrincipalCache } from './principal-cache'
import { UserProvisioner } from './user-provisioner'

// Who is calling and may they use the API; roles and bans are always read from our store, never from the token
export interface Principal {
  user: User
  identity: Identity
}

export class AuthService {
  constructor(
    private readonly verifier: IdentityVerifier,
    private readonly provisioner: UserProvisioner,
    private readonly cache?: PrincipalCache
  ) {}

  async authenticate(token: string): Promise<Principal> {
    const cached = this.cache?.get(token)

    if (cached) {
      return cached
    }

    const identity = await this.verifier.verify(token)
    const user = await this.provisioner.ensureUser(identity)

    assertCanUseApi(user, identity.emailVerified)

    const principal = { user, identity }
    this.cache?.set(token, principal)

    return principal
  }
}
