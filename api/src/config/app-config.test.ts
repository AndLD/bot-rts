import { ConfigError, loadConfig } from './app-config'

const base = { DATABASE_URL: 'postgresql://botrts:botrts@localhost:5432/botrts' }

describe('loadConfig', () => {
  it('applies the development defaults', () => {
    expect(loadConfig(base)).toEqual({
      nodeEnv: 'development',
      port: 8080,
      databaseUrl: base.DATABASE_URL,
      frontendUrl: 'http://localhost:5173',
      adminUrl: 'http://localhost:5173',
      corsOrigins: ['http://localhost:5173'],
      worldSeed: undefined,
      world: { resourceChance: 0.2, spawnMaxDistance: 10, spawnAttempts: 20 },
      smtp: undefined
    })
  })

  it('reads every setting from the environment', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'test',
      PORT: '0',
      FRONTEND_URL: 'https://play.example',
      ADMIN_URL: 'https://admin.example',
      WHITELIST_URLS: 'https://a.example, https://b.example,',
      WORLD_SEED: '42',
      WORLD_RESOURCE_CHANCE: '0.5',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      SMTP_HOST: 'smtp.example.com'
    })

    expect(config).toMatchObject({
      nodeEnv: 'test',
      port: 0,
      frontendUrl: 'https://play.example',
      adminUrl: 'https://admin.example',
      corsOrigins: ['https://a.example', 'https://b.example'],
      worldSeed: 42,
      world: { resourceChance: 0.5 },
      smtp: { host: 'smtp.example.com', user: 'u' }
    })
  })

  it('accepts the postgres:// scheme and an empty PORT', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x@h/db', PORT: '' }).port).toBe(8080)
  })

  it('lists every problem at once', () => {
    expect.assertions(4)

    try {
      loadConfig({ NODE_ENV: 'staging', PORT: 'abc', DATABASE_URL: 'mongodb://x' })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).problems).toHaveLength(3)
      expect((error as ConfigError).message).toContain('NODE_ENV must be one of')
      expect((error as ConfigError).message).toContain('DATABASE_URL')
    }
  })

  it('rejects a missing database URL and out-of-range ports', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow('PORT')
    expect(() => loadConfig({ ...base, PORT: '1.5' })).toThrow('PORT')
  })

  it('requires the JWT secrets in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('JWT_ACCESS_SECRET is required in production')

    expect(
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a',
        JWT_REFRESH_SECRET: 'b',
        JWT_EMAIL_VERIFICATION_SECRET: 'c'
      }).nodeEnv
    ).toBe('production')
  })
})
