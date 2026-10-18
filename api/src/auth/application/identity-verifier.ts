import { Identity } from '../domain/identity'

export const IDENTITY_VERIFIER = Symbol('IdentityVerifier')

// Turns a bearer token into an Identity; the only place that understands a provider's tokens (docs/engineering/architecture.md §1).
// Rejects with an AppError when the token is invalid, expired or revoked.
export interface IdentityVerifier {
  verify(token: string): Promise<Identity>
}
