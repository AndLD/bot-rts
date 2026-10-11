import { jwtDecode } from 'jwt-decode'

interface AccessTokenClaims {
  exp: number
}

export function isJwtExpired(token: string) {
  return Date.now() >= jwtDecode<AccessTokenClaims>(token).exp * 1000
}
