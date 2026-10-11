// The secrets of the custom provider; they exist only for users who registered with an email and a password
export interface LocalCredential {
  readonly userId: string
  readonly passwordHash: string
  readonly emailVerified: boolean
  readonly updatedAt: Date
}
