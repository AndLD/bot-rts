import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { User } from '../domain/user.entity'

export const USER_REPOSITORY = Symbol('UserRepository')

export interface UserListQuery {
  status?: UserStatus
  isActive?: boolean
  email?: string
  offset: number
  limit: number
}

export interface UserPage {
  users: User[]
  total: number
}

export type UserCountByStatus = Record<UserStatus, number>

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  add(user: User): Promise<void>
  update(user: User): Promise<void>
  list(query: UserListQuery): Promise<UserPage>
  countByStatus(): Promise<UserCountByStatus>
  deleteInactiveCreatedBefore(date: Date): Promise<number>
}
