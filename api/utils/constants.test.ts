describe('constants', () => {
  const load = (env: Record<string, string>) => {
    const saved = { ...process.env }
    Object.assign(process.env, env)
    let loaded: typeof import('./constants') | undefined
    jest.isolateModules(() => {
      loaded = require('./constants')
    })
    process.env = saved
    return loaded!
  }

  it('falls back to development defaults', () => {
    const saved = { ...process.env }
    delete process.env.NODE_ENV
    delete process.env.FRONTEND_URL
    delete process.env.RATE_LIMIT_WINDOW_MS
    delete process.env.RATE_LIMIT_AUTH_MAX
    let constants: typeof import('./constants') | undefined
    jest.isolateModules(() => {
      constants = require('./constants')
    })
    process.env = saved

    expect(constants).toMatchObject({
      environment: 'development',
      isProduction: false,
      FRONTEND_URL: 'http://localhost:5173',
      rateLimit: { windowMs: 900000, maxAuthRequests: 20 }
    })
  })

  it('reads the environment', () => {
    expect(
      load({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://x',
        RATE_LIMIT_WINDOW_MS: '1000',
        RATE_LIMIT_AUTH_MAX: '3'
      })
    ).toMatchObject({
      isProduction: true,
      FRONTEND_URL: 'https://x',
      rateLimit: { windowMs: 1000, maxAuthRequests: 3 }
    })
  })
})
