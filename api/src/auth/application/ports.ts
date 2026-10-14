import { AuthToken, AuthTokenKind } from '../domain/auth-token'
import { IdentityLink } from '../domain/identity'
import { LoginAttempt } from '../domain/login-attempt'
import { LocalCredential } from '../domain/local-credential'
import { Session } from '../domain/session'

export const IDENTITY_REPOSITORY = Symbol('IdentityRepository')
export const CREDENTIAL_REPOSITORY = Symbol('CredentialRepository')
export const SESSION_REPOSITORY = Symbol('SessionRepository')
export const AUTH_TOKEN_REPOSITORY = Symbol('AuthTokenRepository')
export const ACCESS_TOKEN_SERVICE = Symbol('AccessTokenService')
export const SECRET_GENERATOR = Symbol('SecretGenerator')
export const PASSWORD_HASHER = Symbol('PasswordHasher')
export const AUTH_MAILER = Symbol('AuthMailer')
export const LOGIN_ATTEMPT_LOG = Symbol('LoginAttemptLog')

export interface IdentityRepository {
  findByIdentity(provider: string, subject: string): Promise<IdentityLink | null>
  add(link: IdentityLink): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}

export interface CredentialRepository {
  findByUserId(userId: string): Promise<LocalCredential | null>
  add(credential: LocalCredential): Promise<void>
  update(credential: LocalCredential): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}

export interface SessionRepository {
  findById(id: string): Promise<Session | null>
  findByRefreshTokenHash(hash: string): Promise<Session | null>
  add(session: Session): Promise<void>
  update(session: Session): Promise<void>
  // Revokes every active session of the user, except the given one
  revokeAllOfUser(userId: string, now: Date, exceptSessionId?: string): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}

export interface AuthTokenRepository {
  findByHash(hash: string): Promise<AuthToken | null>
  add(token: AuthToken): Promise<void>
  markUsed(id: string, now: Date): Promise<void>
  // Invalidates the pending tokens of a kind, so a new link replaces the previous one
  expirePending(userId: string, kind: AuthTokenKind, now: Date): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}

export interface AccessTokenClaims {
  userId: string
  sessionId: string
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string
  // Throws AccessTokenExpiredError for an expired token and UnauthorizedError for any other invalid one
  verify(token: string): AccessTokenClaims
}

export interface SecretGenerator {
  // A new random secret for a link or a refresh token
  generate(): string
  // The one-way hash under which a secret is stored and looked up
  hash(secret: string): string
}

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}

// The emails of the account flows; implementations build the links to the web client
export interface AuthMailer {
  sendEmailVerification(to: string, token: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
  sendEmailChange(to: string, token: string): Promise<void>
  sendAccountDeletion(to: string, token: string): Promise<void>
}

// Where sign-in attempts are kept. It is not part of the unit of work: a failed attempt must be written although the sign-in is
// rolled back.
export interface LoginAttemptLog {
  record(attempt: LoginAttempt): Promise<void>
}
