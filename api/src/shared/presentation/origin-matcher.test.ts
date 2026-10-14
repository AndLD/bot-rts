import { invalidOrigins, originMatcher } from './origin-matcher'

describe('originMatcher', () => {
  const allowed = originMatcher([
    'https://play.example',
    'https://bot-rts-*.vercel.app',
    'https://*.preview.example.com'
  ])

  it('lets exact origins through, and requests without an Origin header (not a browser)', () => {
    expect(allowed('https://play.example')).toBe(true)
    expect(allowed(undefined)).toBe(true)
    expect(allowed('https://play.example.evil.com')).toBe(false)
    expect(allowed('http://play.example')).toBe(false)
    expect(allowed('https://other.example')).toBe(false)
  })

  it('lets the preview deployments through by their wildcard, in one label only', () => {
    expect(allowed('https://bot-rts-git-feature-x-andld.vercel.app')).toBe(true)
    expect(allowed('https://bot-rts-.vercel.app')).toBe(true)
    expect(allowed('https://other-project.vercel.app')).toBe(false)
    expect(allowed('https://pr-12.preview.example.com')).toBe(true)
    expect(allowed('https://a.b.preview.example.com')).toBe(false)
    expect(allowed('https://preview.example.com')).toBe(false)
    expect(allowed('https://bot-rts-x.vercel.app.evil.com')).toBe(false)
  })

  it('treats the dots of a pattern as dots, not as any character', () => {
    expect(originMatcher(['https://app-*.example.com'])('https://app-1xexample.com')).toBe(false)
  })

  it('allows nothing when no origin is listed, except requests without an Origin header', () => {
    expect(originMatcher([])('https://play.example')).toBe(false)
    expect(originMatcher([])(undefined)).toBe(true)
  })
})

describe('invalidOrigins', () => {
  it('accepts exact origins and safe wildcards', () => {
    expect(
      invalidOrigins([
        'https://play.example',
        'http://localhost:5173',
        'https://bot-rts-*.vercel.app',
        'https://*.preview.example.com'
      ])
    ).toEqual([])
    expect(invalidOrigins([])).toEqual([])
  })

  it('refuses what is not an origin', () => {
    expect(invalidOrigins(['play.example', 'https://play.example/path', '*'])).toHaveLength(3)
  })

  it('refuses a wildcard that would match every site of a host, or stands anywhere but in the first label', () => {
    const problems = invalidOrigins(['https://*.vercel.app', 'https://app.*.example.com', 'https://*', 'https://*.com'])

    expect(problems).toHaveLength(4)
    expect(problems[0]).toContain('too many sites')
    expect(problems[1]).toContain('first label')
  })
})
