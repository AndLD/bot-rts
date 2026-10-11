export type Subscription = (typeof SUBSCRIPTIONS)[number]

export interface IUserState {
  _id: string
  name: string
  email: string
  status: UserStatus
  active: boolean
  subscription: Subscription
  createdAt: number
  updatedAt?: number
}

export interface IUserInfo {
  _id: string
  name: string
  email: string
  status: UserStatus
  active: boolean
  subscription: Subscription
  createdAt: number
  updatedAt?: number
  keywords?: string[]
  user?: string
}

export interface IUserPostBody {
  name: string
  email: string
  password: string
}

export const USER_STATUSES = ['admin', 'owner', 'user', 'unlimited', 'banned'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export const SUBSCRIPTIONS = ['free', 'monthly', 'yearly'] as const

export interface IFetchUsersResponse {
  result: IUserInfo[]
  meta: {
    pagination: {
      page: number
      results: number
      total: number
    }
  }
}

// The `status` can be changed by an owner only
export interface IUserPutBody {
  name?: string
  subscription?: Subscription
  status?: UserStatus
}

export interface IUsersFilter {
  status?: UserStatus
  active?: boolean
  email?: string
}

export interface IUserPutResponse {
  result: IUserInfo
}
