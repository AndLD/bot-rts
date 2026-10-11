import { DEFAULT_AUTH_POLICY } from '../auth/domain/auth-policy'
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
      smtp: undefined,
      emailOutboxDir: undefined,
      auth: {
        provider: 'local',
        accessSecret: 'development-only-access-secret',
        accessTtlSeconds: 600,
        policy: { ...DEFAULT_AUTH_POLICY, sessionTtlMs: 30 * 24 * 3600 * 1000 }
      },
      rateLimit: { windowMs: 15 * 60 * 1000, authMax: 20 },
      trustProxy: false
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
      SMTP_HOST: 'smtp.example.com',
      EMAIL_OUTBOX_DIR: '/tmp/outbox',
      JWT_ACCESS_SECRET: 's3cret',
      JWT_ACCESS_EXPIRES_IN: '5m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_AUTH_MAX: '5',
      TRUST_PROXY: 'true'
    })

    expect(config).toMatchObject({
      nodeEnv: 'test',
      port: 0,
      frontendUrl: 'https://play.example',
      adminUrl: 'https://admin.example',
      corsOrigins: ['https://a.example', 'https://b.example'],
      worldSeed: 42,
      world: { resourceChance: 0.5 },
      smtp: { host: 'smtp.example.com', user: 'u' },
      emailOutboxDir: '/tmp/outbox',
      auth: { accessSecret: 's3cret', accessTtlSeconds: 300, policy: { sessionTtlMs: 7 * 24 * 3600 * 1000 } },
      rateLimit: { windowMs: 60000, authMax: 5 },
      trustProxy: true
    })
  })

  it('accepts the postgres:// scheme and an empty PORT', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x@h/db', PORT: '' }).port).toBe(8080)
  })

  it('lists every problem at once', () => {
    expect.assertions(4)

    try {
      loadConfig({
        NODE_ENV: 'staging',
        PORT: 'abc',
        DATABASE_URL: 'mongodb://x',
        AUTH_PROVIDER: 'clerk',
        JWT_ACCESS_EXPIRES_IN: 'soon'
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).problems).toHaveLength(5)
      expect((error as ConfigError).message).toContain('NODE_ENV must be one of')
      expect((error as ConfigError).message).toContain('DATABASE_URL')
    }
  })

  it('rejects a missing database URL and out-of-range ports', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow('PORT')
    expect(() => loadConfig({ ...base, PORT: '1.5' })).toThrow('PORT')
  })

  it('requires the access token secret in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('JWT_ACCESS_SECRET is required in production')

    expect(loadConfig({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'a' }).nodeEnv).toBe('production')
  })

  it('falls back on a malformed rate limit maximum', () => {
    expect(loadConfig({ ...base, RATE_LIMIT_AUTH_MAX: 'many' }).rateLimit.authMax).toBe(20)
    expect(loadConfig({ ...base, RATE_LIMIT_AUTH_MAX: '-3' }).rateLimit.authMax).toBe(20)
  })
})
