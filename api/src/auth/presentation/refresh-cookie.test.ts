import { createRefreshCookieOptions } from './refresh-cookie'

const base = { sessionTtlMs: 1000, domain: undefined }

describe('createRefreshCookieOptions', () => {
  it('is secure and for the auth routes only', () => {
    expect(createRefreshCookieOptions({ ...base, nodeEnv: 'production', sameSite: 'lax' })).toEqual({
      secure: true,
      sameSite: 'lax',
      domain: undefined,
      path: '/api/v1/auth',
      maxAgeMs: 1000
    })
  })

  it('works over plain HTTP in development', () => {
    expect(createRefreshCookieOptions({ ...base, nodeEnv: 'development', sameSite: 'lax' })).toMatchObject({
      secure: false,
      sameSite: 'lax'
    })
  })

  it('is secure whatever the environment when it must cross sites, and may name a parent domain', () => {
    expect(
      createRefreshCookieOptions({ ...base, nodeEnv: 'development', sameSite: 'none', domain: 'example.com' })
    ).toMatchObject({ secure: true, sameSite: 'none', domain: 'example.com' })
  })
})
