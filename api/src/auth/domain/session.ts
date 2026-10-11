export interface Session {
  readonly id: string
  readonly userId: string
  // The refresh token itself is never stored
  readonly refreshTokenHash: string
  readonly createdAt: Date
  readonly lastUsedAt: Date
  readonly expiresAt: Date
  readonly revokedAt: Date | null
  readonly userAgent: string | null
}

export function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now
}
