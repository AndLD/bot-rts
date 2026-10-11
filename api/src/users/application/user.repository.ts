import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { User, UserListItem } from '../domain/user.entity'

export const USER_REPOSITORY = Symbol('UserRepository')

export interface UserListQuery {
  status?: UserStatus
  isEmailVerified?: boolean
  email?: string
  offset: number
  limit: number
}

export interface UserPage {
  users: UserListItem[]
  total: number
}

export type UserCountByStatus = Record<UserStatus, number>

export interface UserRepository {
  findById(id: string): Promise<User | null>
  // The user together with the verification state of their email, as the administration shows it
  findListItemById(id: string): Promise<UserListItem | null>
  findByEmail(email: string): Promise<User | null>
  add(user: User): Promise<void>
  update(user: User): Promise<void>
  list(query: UserListQuery): Promise<UserPage>
  countByStatus(): Promise<UserCountByStatus>
}
