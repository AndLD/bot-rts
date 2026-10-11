import { Subscription, UserStatus } from '../../../../lib/utils/interfaces/users'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError } from '../../shared/domain/errors'
import { assertCanUpdate, assertCanUseApi, UserPatch } from '../domain/user-access'
import { User } from '../domain/user.entity'
import { CredentialsInvalidError, EmailAlreadyExistsError } from '../domain/user.errors'
import { PasswordHasher } from './password-hasher'
import { UserCountByStatus, UserPage, UserRepository } from './user.repository'

export interface RegisterUserInput {
  name: string
  email: string
  password: string
}

export interface ListUsersInput {
  status?: UserStatus
  isActive?: boolean
  email?: string
  page: number
  pageSize: number
}

// Users who never verified their email are removed after this time
const UNVERIFIED_LIFETIME_MS = 24 * 60 * 60 * 1000

export class UsersService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async register({ name, email, password }: RegisterUserInput): Promise<User> {
    if (await this.users.findByEmail(email)) {
      throw new EmailAlreadyExistsError()
    }

    const user: User = {
      id: this.ids.next(),
      name,
      email,
      passwordHash: await this.hasher.hash(password),
      status: 'user',
      isActive: false,
      subscription: 'free' as Subscription,
      createdAt: this.clock.now(),
      updatedAt: null
    }
    await this.users.add(user)

    return user
  }

  async authenticate(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email)

    if (!user || !(await this.hasher.verify(password, user.passwordHash))) {
      throw new CredentialsInvalidError()
    }
    assertCanUseApi(user)

    return user
  }

  // The current state of an account that may use the API; roles and bans are always read from the store
  async getUsableUser(id: string): Promise<User> {
    const user = await this.users.findById(id)
    assertCanUseApi(user)

    return user
  }

  async activate(id: string): Promise<User> {
    const user = await this.users.findById(id)

    if (!user || user.isActive) {
      throw new NotFoundError('No user waiting for verification')
    }

    const activated = { ...user, isActive: true }
    await this.users.update(activated)

    return activated
  }

  list({ page, pageSize, ...filter }: ListUsersInput): Promise<UserPage> {
    return this.users.list({ ...filter, offset: (page - 1) * pageSize, limit: pageSize })
  }

  async update(actorStatus: UserStatus, id: string, patch: UserPatch): Promise<User> {
    const target = await this.users.findById(id)

    if (!target) {
      throw new NotFoundError('User not found')
    }
    assertCanUpdate(actorStatus, target, patch)

    const { password, ...fields } = patch
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
    const updated: User = {
      ...target,
      ...changes,
      passwordHash: password === undefined ? target.passwordHash : await this.hasher.hash(password),
      updatedAt: this.clock.now()
    }
    await this.users.update(updated)

    return updated
  }

  countByStatus(): Promise<UserCountByStatus> {
    return this.users.countByStatus()
  }

  purgeUnverified(): Promise<number> {
    return this.users.deleteInactiveCreatedBefore(new Date(this.clock.now().getTime() - UNVERIFIED_LIFETIME_MS))
  }
}
