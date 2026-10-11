import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors'
import { EmailNotVerifiedError, UserBannedError } from './user.errors'
import { User } from './user.entity'

export interface UserPatch {
  name?: string
  subscription?: User['subscription']
  status?: UserStatus
  isActive?: boolean
  password?: string
}

// Fields only an owner may change
const OWNER_ONLY_FIELDS: readonly (keyof UserPatch)[] = ['status', 'isActive', 'password']

export function isAdmin(status: UserStatus): boolean {
  return status === 'admin' || status === 'owner'
}

// A user may use the API only when the account exists, is not banned and its email is verified
export function assertCanUseApi(user: User | null): asserts user is User {
  if (!user) {
    throw new UnauthorizedError('Unknown user')
  }
  if (user.status === 'banned') {
    throw new UserBannedError()
  }
  if (!user.isActive) {
    throw new EmailNotVerifiedError()
  }
}

// Admins edit regular accounts; owners edit everything, and only owners change status, activation and password
export function assertCanUpdate(actorStatus: UserStatus, target: User, patch: UserPatch): void {
  if (actorStatus === 'owner') {
    return
  }
  if (!isAdmin(actorStatus)) {
    throw new ForbiddenError()
  }
  if (OWNER_ONLY_FIELDS.some((field) => patch[field] !== undefined) || isAdmin(target.status)) {
    throw new ForbiddenError()
  }
}
