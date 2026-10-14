import { corsOptions, helmetOptions } from './security-headers'

describe('security headers', () => {
  it('turns on HSTS and upgrade-insecure-requests only in production', () => {
    const production = helmetOptions(true)
    const development = helmetOptions(false)

    expect(production.strictTransportSecurity).toMatchObject({ includeSubDomains: true })
    expect(development.strictTransportSecurity).toBe(false)
    expect(
      (production.contentSecurityPolicy as { directives: Record<string, unknown> }).directives[
        'upgrade-insecure-requests'
      ]
    ).toEqual([])
    expect(
      (development.contentSecurityPolicy as { directives: Record<string, unknown> }).directives[
        'upgrade-insecure-requests'
      ]
    ).toBeNull()
  })

  it('narrows CORS to the methods and headers the API uses', () => {
    const options = corsOptions((origin) => origin === 'https://play.example')
    const answers: unknown[] = []
    const origin = options.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void

    origin('https://play.example', (error, allow) => answers.push([error, allow]))
    origin('https://evil.example', (error) => answers.push(error?.message))

    expect(answers).toEqual([[null, true], 'Origin is not allowed'])
    expect(options).toMatchObject({ credentials: true, methods: expect.not.arrayContaining(['OPTIONS', 'TRACE']) })
    expect(options.allowedHeaders).toEqual(['Authorization', 'Content-Type'])
    expect(options.exposedHeaders).toContain('Retry-After')
  })
})
