export const LOCAL_PROVIDER = 'local'

// What a token proves about the caller, whichever provider issued it (AGENTS.md §3.3)
export interface Identity {
  readonly provider: string
  readonly subject: string
  readonly email: string
  readonly emailVerified: boolean
  // Only the custom provider has sessions
  readonly sessionId?: string
}

// The link from a provider's identity to the player
export interface IdentityLink {
  readonly id: string
  readonly provider: string
  readonly subject: string
  readonly userId: string
  readonly createdAt: Date
}
