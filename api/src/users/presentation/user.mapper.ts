import { IUserInfo, IUserState } from '../../../../lib/utils/interfaces/users'
import { User } from '../domain/user.entity'

// The identity carried to the client; never contains a password hash. `active` means the email is verified.
export function toUserState(user: User, isEmailVerified: boolean): IUserState {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    active: isEmailVerified,
    subscription: user.subscription,
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt?.getTime()
  }
}

export function toUserInfo(user: User, isEmailVerified: boolean): IUserInfo {
  return toUserState(user, isEmailVerified)
}
