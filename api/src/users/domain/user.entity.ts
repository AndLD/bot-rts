import { Subscription, UserStatus } from '../../../../lib/utils/interfaces/users'

// The player, independent of how they log in: logins live in the auth feature (identities and credentials)
export interface User {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly status: UserStatus
  readonly subscription: Subscription
  readonly createdAt: Date
  readonly updatedAt: Date | null
  // The version of the privacy policy the player accepted at sign-up and when; null for a player that came through a hosted provider
  readonly privacyAcceptedVersion: string | null
  readonly privacyAcceptedAt: Date | null
  // Set when the player deleted the account; personal data is already erased
  readonly deletedAt: Date | null
}

export interface UserListItem extends User {
  readonly isEmailVerified: boolean
}
