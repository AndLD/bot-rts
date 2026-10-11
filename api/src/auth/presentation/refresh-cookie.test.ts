import { createRefreshCookieOptions } from './refresh-cookie'

describe('createRefreshCookieOptions', () => {
  it('is secure and cross-site in production', () => {
    expect(createRefreshCookieOptions({ nodeEnv: 'production', sessionTtlMs: 1000 })).toEqual({
      secure: true,
      sameSite: 'none',
      path: '/api/v1/auth',
      maxAgeMs: 1000
    })
  })

  it('works over plain HTTP in development', () => {
    expect(createRefreshCookieOptions({ nodeEnv: 'development', sessionTtlMs: 5 })).toMatchObject({
      secure: false,
      sameSite: 'lax'
    })
  })
})
