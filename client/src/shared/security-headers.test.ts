import { SECURITY_HEADERS } from './security-headers'

describe('SECURITY_HEADERS', () => {
  it('forbid framing and sniffing, limit the referrer and switch off unused features', () => {
    const byKey = Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value]))

    expect(byKey['X-Frame-Options']).toBe('DENY')
    expect(byKey['X-Content-Type-Options']).toBe('nosniff')
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(byKey['Permissions-Policy']).toContain('camera=()')
    expect(byKey['Strict-Transport-Security']).toContain('max-age=')
  })

  it('name each header once', () => {
    const keys = SECURITY_HEADERS.map(({ key }) => key)

    expect(new Set(keys).size).toBe(keys.length)
  })
})
