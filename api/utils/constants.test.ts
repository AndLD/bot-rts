type Constants = typeof import('./constants')

// The constants are read when the module loads, so every case loads a fresh copy under its own environment
function loadConstants(env: Record<string, string | undefined>): Constants {
  const saved = { ...process.env }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  let loaded: Constants | undefined
  jest.isolateModules(() => {
    loaded = jest.requireActual<Constants>('./constants')
  })
  process.env = saved

  return loaded as Constants
}

describe('constants', () => {
  it('falls back to development defaults', () => {
    const constants = loadConstants({
      NODE_ENV: undefined,
      PORT: undefined,
      FRONTEND_URL: undefined,
      RATE_LIMIT_WINDOW_MS: undefined,
      RATE_LIMIT_AUTH_MAX: undefined
    })

    expect(constants).toMatchObject({
      environment: 'development',
      isProduction: false,
      port: 8080,
      FRONTEND_URL: 'http://localhost:5173',
      rateLimit: { windowMs: 900000, maxAuthRequests: 20 }
    })
  })

  it('reads the environment', () => {
    const constants = loadConstants({
      NODE_ENV: 'production',
      PORT: '9000',
      FRONTEND_URL: 'https://x',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_AUTH_MAX: '3'
    })

    expect(constants).toMatchObject({
      isProduction: true,
      port: '9000',
      FRONTEND_URL: 'https://x',
      rateLimit: { windowMs: 1000, maxAuthRequests: 3 }
    })
  })
})
