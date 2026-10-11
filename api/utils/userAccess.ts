import { IUser, IUserState } from '@lib/utils/interfaces/users'
import { errors } from './constants'
import { Error as ApiError } from '@lib/utils/types'

export function toUserState(user: IUser): IUserState {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    status: user.status,
    active: user.active,
    subscription: user.subscription,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

// Returns the reason a user may not use the API, or undefined when access is allowed
export function getAccessDenial(user: IUser | null): ApiError | undefined {
  if (!user) {
    return errors.JWT_INVALID
  }

  if (user.status === 'banned') {
    return errors.USER_BANNED
  }

  if (!user.active) {
    return errors.EMAIL_NOT_VERIFIED
  }

  return undefined
}
