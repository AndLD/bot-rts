import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { Clock } from '../../shared/application/clock'
import { NotFoundError } from '../../shared/domain/errors'
import { assertCanUpdate, UserPatch } from '../domain/user-access'
import { User, UserListItem } from '../domain/user.entity'
import { UserCountByStatus, UserPage, UserRepository } from './user.repository'

export interface ListUsersInput {
  status?: UserStatus
  isEmailVerified?: boolean
  email?: string
  page: number
  pageSize: number
}

// Profile and administration of players; logins and credentials belong to the auth feature
export class UsersService {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock
  ) {}

  async get(id: string): Promise<User> {
    const user = await this.users.findById(id)

    if (!user || user.deletedAt) {
      throw new NotFoundError('User not found')
    }

    return user
  }

  list({ page, pageSize, ...filter }: ListUsersInput): Promise<UserPage> {
    return this.users.list({ ...filter, offset: (page - 1) * pageSize, limit: pageSize })
  }

  async update(actorStatus: UserStatus, id: string, patch: UserPatch): Promise<UserListItem> {
    const target = await this.get(id)

    assertCanUpdate(actorStatus, target, patch)

    const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
    const updated: User = { ...target, ...changes, updatedAt: this.clock.now() }
    await this.users.update(updated)

    return (await this.users.findListItemById(id)) as UserListItem
  }

  countByStatus(): Promise<UserCountByStatus> {
    return this.users.countByStatus()
  }
}
