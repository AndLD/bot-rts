export type AuthTokenKind = 'email_verification' | 'password_reset' | 'email_change' | 'account_deletion'

// A single-use link sent by email; only the hash of the secret is stored
export interface AuthToken {
  readonly id: string
  readonly userId: string
  readonly kind: AuthTokenKind
  readonly tokenHash: string
  readonly newEmail: string | null
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly usedAt: Date | null
}

export function isAuthTokenUsable(token: AuthToken, now: Date): boolean {
  return token.usedAt === null && token.expiresAt > now
}
