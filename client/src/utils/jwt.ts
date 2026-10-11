import { jwtDecode } from 'jwt-decode'
import { IUserState } from '@lib/utils/interfaces/users'

interface AccessTokenClaims {
  user: IUserState
  exp: number
}

export function parseUser(token: string | null): IUserState | null {
  return token ? jwtDecode<AccessTokenClaims>(token).user : null
}

export function isJwtExpired(token: string) {
  return Date.now() >= jwtDecode<AccessTokenClaims>(token).exp * 1000
}
