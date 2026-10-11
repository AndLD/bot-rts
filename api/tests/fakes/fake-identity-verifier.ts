import { IdentityVerifier } from '../../src/auth/application/identity-verifier'
import { Identity } from '../../src/auth/domain/identity'
import { UnauthorizedError } from '../../src/shared/domain/errors'

// A verifier for tests of anything that sits behind authentication: tokens are handed out by `issue`
export class FakeIdentityVerifier implements IdentityVerifier {
  private readonly identities = new Map<string, Identity>()
  private counter = 0

  issue(identity: Identity): string {
    this.counter += 1
    const token = `fake-token-${this.counter}`
    this.identities.set(token, identity)
    return token
  }

  async verify(token: string): Promise<Identity> {
    const identity = this.identities.get(token)

    if (!identity) {
      throw new UnauthorizedError('The token is invalid')
    }

    return identity
  }
}
