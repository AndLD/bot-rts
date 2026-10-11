export const REFRESH_COOKIE = 'refreshToken'

export interface RefreshCookieOptions {
  secure: boolean
  sameSite: 'lax' | 'none'
  path: string
  maxAgeMs: number
}
