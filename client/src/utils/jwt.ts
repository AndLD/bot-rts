import { jwtDecode } from 'jwt-decode'
import { IUserState } from './interfaces/users'

export function parseUser(token: string | null): IUserState | null {
    return token ? (jwtDecode(token) as any).user : null
}

export function isJwtExpired(token: string) {
    const decodeValue: any = jwtDecode(token)

    return Date.now() >= decodeValue.exp * 1000
}
