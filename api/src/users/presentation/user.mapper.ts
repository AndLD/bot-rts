import { IUserInfo, IUserState } from '../../../../lib/utils/interfaces/users'
import { User } from '../domain/user.entity'

// The identity carried in access tokens and returned to the client; never contains the password hash
export function toUserState(user: User): IUserState {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    active: user.isActive,
    subscription: user.subscription,
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt?.getTime()
  }
}

export function toUserInfo(user: User): IUserInfo {
  return toUserState(user)
}
