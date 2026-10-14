export const REFRESH_COOKIE = 'refreshToken'

export interface RefreshCookieOptions {
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  domain: string | undefined
  path: string
  maxAgeMs: number
}

interface CookieSettings {
  nodeEnv: string
  sessionTtlMs: number
  sameSite: RefreshCookieOptions['sameSite']
  domain: string | undefined
}

// The cookie is limited to the auth routes and is never readable by scripts. It is `Secure` in production, and always when
// `SameSite=None` (browsers refuse the combination otherwise).
export function createRefreshCookieOptions({
  nodeEnv,
  sessionTtlMs,
  sameSite,
  domain
}: CookieSettings): RefreshCookieOptions {
  return {
    secure: nodeEnv === 'production' || sameSite === 'none',
    sameSite,
    domain,
    path: '/api/v1/auth',
    maxAgeMs: sessionTtlMs
  }
}
