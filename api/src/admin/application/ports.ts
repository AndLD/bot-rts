import { AuditEntry, AuditFilter } from '../domain/audit-entry'
import { SecondFactor } from '../domain/second-factor'

export const AUDIT_LOG = Symbol('AuditLog')
export const SECOND_FACTOR_REPOSITORY = Symbol('SecondFactorRepository')
export const TOTP = Symbol('Totp')
export const RECOVERY_CODES = Symbol('RecoveryCodes')
export const SECRET_CIPHER = Symbol('SecretCipher')

// Append-only: there is no way to change or remove an entry
export interface AuditLog {
  append(entry: AuditEntry): Promise<void>
  list(filter: AuditFilter, page: { page: number; pageSize: number }): Promise<{ entries: AuditEntry[]; total: number }>
}

export interface SecondFactorRepository {
  find(userId: string): Promise<SecondFactor | null>
  // Starts (or restarts, while it is not enabled) the enrollment
  save(factor: SecondFactor): Promise<void>
  findSessionVerification(sessionId: string): Promise<Date | null>
  saveSessionVerification(sessionId: string, verifiedAt: Date): Promise<void>
}

export interface Totp {
  generateSecret(): string
  otpauthUrl(params: { secret: string; account: string; issuer: string }): string
  // The time step of an accepted code (RFC 6238, with one step of tolerance either way), or null
  verify(secret: string, code: string, nowMs: number): number | null
}

export interface SecretCipher {
  encrypt(plain: string): string
  decrypt(encrypted: string): string
}

export interface RecoveryCodes {
  generate(count: number): string[]
  // Codes are random and long, so a fast one-way hash is enough to store them
  hash(code: string): string
}
