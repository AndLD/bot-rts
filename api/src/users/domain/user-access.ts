import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors'
import { EmailNotVerifiedError, UserBannedError } from './user.errors'
import { User } from './user.entity'

export interface UserPatch {
  name?: string
  subscription?: User['subscription']
  status?: UserStatus
}

export function isAdmin(status: UserStatus): boolean {
  return status === 'admin' || status === 'owner'
}

// An account may use the API when it exists, was not deleted, is not banned and its email is verified. Whether the email
// is verified is a fact of the identity provider, so the caller passes it in.
export function assertCanUseApi(user: User | null, isEmailVerified: boolean): asserts user is User {
  if (!user || user.deletedAt) {
    throw new UnauthorizedError('Unknown user')
  }
  if (user.status === 'banned') {
    throw new UserBannedError()
  }
  if (!isEmailVerified) {
    throw new EmailNotVerifiedError()
  }
}

// Admins edit the profile of regular accounts; owners edit everything, and only owners change the status
export function assertCanUpdate(actorStatus: UserStatus, target: User, patch: UserPatch): void {
  if (actorStatus === 'owner') {
    return
  }
  if (!isAdmin(actorStatus) || patch.status !== undefined || isAdmin(target.status)) {
    throw new ForbiddenError()
  }
}
