import { DEFAULT_AUTH_POLICY } from '../auth/domain/auth-policy'
import { DEFAULT_WORLD_CONFIG } from '../map/domain/world-config'
import { DEFAULT_CRAFTING_CONFIG } from '../crafting/domain/crafting-config'
import { DEFAULT_ENGINE_CONFIG } from '../engine/domain/engine-config'
import { DEFAULT_SPAWN_CONFIG } from '../spawn/domain/spawn-config'
import { DEFAULT_PLAYER_NOTIFICATIONS } from '../player-notifications/domain/notification-policy'
import { DEFAULT_BOT_SECURITY } from '../terminal/domain/bot-security'
import { DEFAULT_TERMINAL_RETENTION } from '../terminal/domain/terminal-retention'
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
      world: DEFAULT_WORLD_CONFIG,
      spawn: DEFAULT_SPAWN_CONFIG,
      crafting: DEFAULT_CRAFTING_CONFIG,
      engine: { ...DEFAULT_ENGINE_CONFIG, isEnabled: true },
      terminal: DEFAULT_TERMINAL_RETENTION,
      botSecurity: DEFAULT_BOT_SECURITY,
      notifications: DEFAULT_PLAYER_NOTIFICATIONS,
      smtp: undefined,
      emailOutboxDir: undefined,
      auth: {
        provider: 'local',
        accessSecret: 'development-only-access-secret',
        accessTtlSeconds: 600,
        policy: { ...DEFAULT_AUTH_POLICY, sessionTtlMs: 30 * 24 * 3600 * 1000 }
      },
      rateLimit: { windowMs: 15 * 60 * 1000, authMax: 20, apiWindowMs: 60_000, apiMax: 600 },
      http: {
        bodyLimitBytes: 262144,
        handlerTimeoutMs: 30000,
        requestTimeoutMs: 60000,
        headersTimeoutMs: 15000,
        keepAliveTimeoutMs: 65000
      },
      trustProxy: false,
      deployment: { role: 'all', redisUrl: undefined, engineRequestTimeoutMs: 15000 }
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
      BOT_ATTEMPT_ENERGY: '9',
      BOT_ATTEMPT_DELAY_MS: '50',
      BOT_LOCKOUT_FAILURES: '2',
      BOT_LOCKOUT_MS: '5000',
      NOTIFICATION_RETENTION_DAYS: '7',
      NOTIFICATION_COALESCE_MS: '5000',
      NOTIFICATION_CAP_PER_MINUTE: '3',
      TERMINAL_LOG_RETENTION_DAYS: '7',
      TERMINAL_LOG_MAX_LINES: '100',
      TERMINAL_SECURITY_RETENTION_DAYS: 'junk',
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
      terminal: { logDays: 7, maxLinesPerBot: 100, securityDays: 90 },
      botSecurity: { attemptEnergy: 9, attemptDelayMs: 50, maxFailures: 2, lockoutMs: 5000 },
      notifications: { retentionDays: 7, coalesceMs: 5000, capPerMinute: 3 },
      smtp: { host: 'smtp.example.com', user: 'u' },
      emailOutboxDir: '/tmp/outbox',
      auth: { accessSecret: 's3cret', accessTtlSeconds: 300, policy: { sessionTtlMs: 7 * 24 * 3600 * 1000 } },
      rateLimit: { windowMs: 60000, authMax: 5 },
      trustProxy: true
    })
  })

  it('fails on an unreadable resource balance file', () => {
    expect(() => loadConfig({ ...base, WORLD_RESOURCE_BALANCE_FILE: '/definitely/missing.json' })).toThrow(
      /WORLD_RESOURCE_BALANCE_FILE/
    )
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

  describe('deployment role', () => {
    it('reads the role, the Redis address and the engine timeout', () => {
      expect(
        loadConfig({ ...base, APP_ROLE: 'api', REDIS_URL: 'redis://localhost:6379', ENGINE_REQUEST_TIMEOUT_MS: '2000' })
          .deployment
      ).toEqual({ role: 'api', redisUrl: 'redis://localhost:6379', engineRequestTimeoutMs: 2000 })
    })

    it('allows Redis on a single node', () => {
      expect(loadConfig({ ...base, REDIS_URL: 'rediss://cache.example:6380' }).deployment.redisUrl).toBe(
        'rediss://cache.example:6380'
      )
    })

    it.each(['api', 'engine'])('needs Redis for the role %s', (role) => {
      expect(() => loadConfig({ ...base, APP_ROLE: role })).toThrow(`REDIS_URL is required when APP_ROLE is ${role}`)
    })

    it('rejects an unknown role and a malformed Redis address', () => {
      expect(() => loadConfig({ ...base, APP_ROLE: 'worker', REDIS_URL: 'http://x' })).toThrow(
        /APP_ROLE must be one of all, api, engine[\s\S]*REDIS_URL must be a redis:\/\/ connection string/
      )
    })
  })

  it('reads the rate limits and the HTTP limits', () => {
    const config = loadConfig({
      ...base,
      RATE_LIMIT_API_MAX: '50',
      RATE_LIMIT_API_WINDOW_MS: '1000',
      HTTP_BODY_LIMIT_BYTES: '1024',
      HTTP_HANDLER_TIMEOUT_MS: '2000',
      HTTP_REQUEST_TIMEOUT_MS: '3000',
      HTTP_HEADERS_TIMEOUT_MS: '4000',
      HTTP_KEEP_ALIVE_TIMEOUT_MS: '5000'
    })

    expect(config.rateLimit).toMatchObject({ apiMax: 50, apiWindowMs: 1000 })
    expect(config.http).toEqual({
      bodyLimitBytes: 1024,
      handlerTimeoutMs: 2000,
      requestTimeoutMs: 3000,
      headersTimeoutMs: 4000,
      keepAliveTimeoutMs: 5000
    })
  })

  it('refuses a wildcard CORS origin, which cannot be combined with credentials', () => {
    expect(() => loadConfig({ ...base, WHITELIST_URLS: 'https://a.example,*' })).toThrow(
      /WHITELIST_URLS must list origins/
    )
  })
})
