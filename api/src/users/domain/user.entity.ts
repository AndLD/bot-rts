import { Subscription, UserStatus } from '../../../../lib/utils/interfaces/users'

export interface User {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly passwordHash: string
  readonly status: UserStatus
  readonly isActive: boolean
  readonly subscription: Subscription
  readonly createdAt: Date
  readonly updatedAt: Date | null
}
