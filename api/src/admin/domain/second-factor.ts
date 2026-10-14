// The TOTP factor of an admin (design §25.2); it protects the account only once `enabledAt` is set
export interface SecondFactor {
  readonly userId: string
  // Encrypted at rest; only the cipher adapter can read it
  readonly secretEncrypted: string
  readonly createdAt: Date
  readonly enabledAt: Date | null
  // The time step of the last accepted code: a code works once
  readonly lastUsedStep: number | null
  readonly recoveryCodeHashes: readonly string[]
}

export function isEnabled(factor: SecondFactor | null): factor is SecondFactor & { enabledAt: Date } {
  return factor !== null && factor.enabledAt !== null
}

// A verification of a session counts until it is older than the allowed age
export function isVerificationFresh(verifiedAt: Date | null, now: Date, ttlMs: number): boolean {
  return verifiedAt !== null && now.getTime() - verifiedAt.getTime() < ttlMs
}
