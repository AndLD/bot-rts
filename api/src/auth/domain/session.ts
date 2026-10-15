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
  // Set on a "view as player" session of an admin: the player it shows and why (design §25.2)
  readonly viewAs: ViewAsClaim | null
}

export interface ViewAsClaim {
  readonly userId: string
  readonly reason: string
}

export function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now
}
