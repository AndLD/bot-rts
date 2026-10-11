export const REFRESH_COOKIE = 'refreshToken'

export interface RefreshCookieOptions {
  secure: boolean
  sameSite: 'lax' | 'none'
  path: string
  maxAgeMs: number
}

interface CookieSettings {
  nodeEnv: string
  sessionTtlMs: number
}

// The cookie is limited to the auth routes; in production the web client and the API may live on different sites
export function createRefreshCookieOptions({ nodeEnv, sessionTtlMs }: CookieSettings): RefreshCookieOptions {
  const isProduction = nodeEnv === 'production'

  return { secure: isProduction, sameSite: isProduction ? 'none' : 'lax', path: '/api/v1/auth', maxAgeMs: sessionTtlMs }
}
