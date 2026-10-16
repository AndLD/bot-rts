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
        policy: { ...DEFAULT_AUTH_POLICY, sessionTtlMs: 30 * 24 * 3600 * 1000 },
        principalCacheMs: 2000,
        cookie: { sameSite: 'lax', domain: undefined }
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
      featureSwitchCacheMs: 5000,
      admin: {
        ipAllowList: [],
        verificationTtlMs: 8 * 60 * 60 * 1000,
        totpIssuer: 'BotRTS',
        recoveryCodeCount: 8,
        secret: 'development-only-access-secret',
        banCheckIntervalMs: 60_000,
        viewAsTtlMs: 30 * 60 * 1000
      },
      monitoring: {
        isEnabled: true,
        sampleIntervalMs: 10_000,
        fineRetentionMs: 7 * 24 * 60 * 60 * 1000,
        coarseStepMs: 60_000,
        coarseRetentionMs: 30 * 24 * 60 * 60 * 1000,
        history: 'memory',
        slowQueryMs: 200,
        alertEmails: [],
        thresholds: {}
      },
      balance: {
        base: { resources: DEFAULT_WORLD_CONFIG.resources, crafting: DEFAULT_CRAFTING_CONFIG },
        version: null,
        problem: null
      },
      devTools: { isEnabled: false },
      observability: {
        metricsToken: undefined,
        logBufferSize: 5000,
        logFormat: 'text',
        isLogFileEnabled: true,
        otlpEndpoint: undefined,
        otlpHeaders: {},
        traceSampleRatio: 1,
        exportQueueSize: 2048,
        logStore: 'memory',
        elasticsearchUrl: undefined,
        elasticsearchApiKey: undefined,
        elasticsearchUsername: undefined,
        elasticsearchPassword: undefined,
        logIndex: 'botrts-logs',
        traceIndex: 'botrts-traces',
        logSearchTimeoutMs: 5000,
        logSearchMaxWindowDays: 7,
        logRetentionDays: 14,
        elasticsearchAdminApiKey: undefined,
        elasticsearchAdminUsername: undefined,
        elasticsearchAdminPassword: undefined,
        gatewayHealthUrl: undefined,
        gatewayMetricsUrl: undefined,
        backupStatusFile: undefined
      },
      lifecycle: {
        isEnabled: true,
        intervalMs: 3600000,
        unverifiedDays: 7,
        inactiveDays: 365,
        noticeDays: 30,
        executionDays: 30,
        authDays: 7,
        activityDays: 400
      },
      deployment: { role: 'all', redisUrl: undefined, engineRequestTimeoutMs: 15000 }
    })
  })

  it('reads the slow query threshold', () => {
    expect(loadConfig({ ...base, SLOW_QUERY_MS: '50' }).monitoring.slowQueryMs).toBe(50)
    expect(loadConfig({ ...base, SLOW_QUERY_MS: '0' }).monitoring.slowQueryMs).toBe(200)
  })

  describe('log store settings', () => {
    it('reads the store, the Elasticsearch address and account, the index and the limits of a search', () => {
      expect(
        loadConfig({
          ...base,
          LOG_STORE: 'elasticsearch',
          ELASTICSEARCH_URL: 'https://es.example:9200',
          ELASTICSEARCH_API_KEY: 'key',
          ELASTICSEARCH_USERNAME: 'reader',
          ELASTICSEARCH_PASSWORD: 'secret',
          LOG_INDEX: 'logs-x',
          TRACE_INDEX: 'traces-x',
          LOG_SEARCH_TIMEOUT_MS: '1000',
          LOG_SEARCH_MAX_WINDOW_DAYS: '3',
          LOG_RETENTION_DAYS: '30',
          ELASTICSEARCH_ADMIN_API_KEY: 'admin-key',
          ELASTICSEARCH_ADMIN_USERNAME: 'admin',
          ELASTICSEARCH_ADMIN_PASSWORD: 'admin-secret'
        }).observability
      ).toMatchObject({
        logStore: 'elasticsearch',
        elasticsearchUrl: 'https://es.example:9200',
        elasticsearchApiKey: 'key',
        elasticsearchUsername: 'reader',
        elasticsearchPassword: 'secret',
        logIndex: 'logs-x',
        traceIndex: 'traces-x',
        logSearchTimeoutMs: 1000,
        logSearchMaxWindowDays: 3,
        logRetentionDays: 30,
        elasticsearchAdminApiKey: 'admin-key',
        elasticsearchAdminUsername: 'admin',
        elasticsearchAdminPassword: 'admin-secret'
      })
    })

    it('refuses an unknown store, and the Elasticsearch store without an address', () => {
      expect(() => loadConfig({ ...base, LOG_STORE: 'file' })).toThrow('LOG_STORE must be memory or elasticsearch')
      expect(() => loadConfig({ ...base, LOG_STORE: 'elasticsearch' })).toThrow(
        'ELASTICSEARCH_URL is required when LOG_STORE is elasticsearch'
      )
    })
  })

  describe('telemetry settings', () => {
    it('writes the log file by default in development and not in production, unless LOG_FILE says otherwise', () => {
      const fileOf = (env: Record<string, string>) =>
        loadConfig({ ...base, JWT_ACCESS_SECRET: 'a', ...env }).observability.isLogFileEnabled

      expect(fileOf({})).toBe(true)
      expect(fileOf({ NODE_ENV: 'production' })).toBe(false)
      expect(fileOf({ NODE_ENV: 'production', LOG_FILE: 'true' })).toBe(true)
      expect(fileOf({ NODE_ENV: 'development', LOG_FILE: 'false' })).toBe(false)
      expect(fileOf({ NODE_ENV: 'production', LOG_FILE: '' })).toBe(false)
    })

    it('reads the log format, the file, the gateway, its headers, the sampling and the queue', () => {
      const { observability } = loadConfig({
        ...base,
        JWT_ACCESS_SECRET: 'a',
        NODE_ENV: 'production',
        LOG_FORMAT: 'text',
        LOG_FILE: 'false',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://gateway.example:4318',
        OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer abc=, x-team = core ,=ignored,',
        OTEL_TRACES_SAMPLER_ARG: '0.25',
        OTEL_EXPORT_QUEUE_SIZE: '100',
        OTEL_GATEWAY_HEALTH_URL: 'http://gateway:13133',
        OTEL_GATEWAY_METRICS_URL: 'http://gateway:8888/metrics'
      })

      expect(observability).toMatchObject({
        logFormat: 'text',
        isLogFileEnabled: false,
        otlpEndpoint: 'https://gateway.example:4318',
        otlpHeaders: { authorization: 'Bearer abc=', 'x-team': 'core' },
        traceSampleRatio: 0.25,
        exportQueueSize: 100,
        gatewayHealthUrl: 'http://gateway:13133',
        gatewayMetricsUrl: 'http://gateway:8888/metrics'
      })
    })

    it('logs JSON in production, and keeps every trace when the sampling share is missing or out of range', () => {
      expect(loadConfig({ ...base, JWT_ACCESS_SECRET: 'a', NODE_ENV: 'production' }).observability.logFormat).toBe(
        'json'
      )
      expect(loadConfig({ ...base, OTEL_TRACES_SAMPLER_ARG: '2' }).observability.traceSampleRatio).toBe(1)
      expect(loadConfig({ ...base, OTEL_TRACES_SAMPLER_ARG: '0' }).observability.traceSampleRatio).toBe(0)
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

  it('enables the dev tools on request, and refuses them in production', () => {
    expect(loadConfig({ ...base, DEV_TOOLS_ENABLED: 'true' }).devTools.isEnabled).toBe(true)
    expect(loadConfig({ ...base, DEV_TOOLS_ENABLED: 'false' }).devTools.isEnabled).toBe(false)
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'a', DEV_TOOLS_ENABLED: 'true' })
    ).toThrow('DEV_TOOLS_ENABLED must not be set in production')
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

  it('refuses origins that are not exact and not a safe wildcard', () => {
    expect(() => loadConfig({ ...base, WHITELIST_URLS: 'https://a.example,*' })).toThrow(
      /WHITELIST_URLS: \*: a wildcard may only stand/
    )
    expect(() => loadConfig({ ...base, WHITELIST_URLS: 'https://*.vercel.app' })).toThrow(/too many sites/)
    expect(loadConfig({ ...base, WHITELIST_URLS: 'https://bot-rts-*.vercel.app' }).corsOrigins).toEqual([
      'https://bot-rts-*.vercel.app'
    ])
  })

  it('sets the cookie for one site by default, for any site in production, and reads the settings', () => {
    expect(loadConfig(base).auth.cookie).toEqual({ sameSite: 'lax', domain: undefined })
    expect(loadConfig({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'x' }).auth.cookie.sameSite).toBe('none')
    expect(loadConfig({ ...base, COOKIE_SAME_SITE: 'strict', COOKIE_DOMAIN: 'example.com' }).auth.cookie).toEqual({
      sameSite: 'strict',
      domain: 'example.com'
    })
    expect(() => loadConfig({ ...base, COOKIE_SAME_SITE: 'sometimes' })).toThrow(/COOKIE_SAME_SITE must be one of/)
  })

  it('reads the data lifecycle policy, where 0 switches inactivity erasure off and tests do not schedule', () => {
    expect(
      loadConfig({
        ...base,
        LIFECYCLE_INTERVAL_MS: '1000',
        UNVERIFIED_ACCOUNT_DAYS: '3',
        INACTIVE_ACCOUNT_DAYS: '0',
        INACTIVE_ACCOUNT_NOTICE_DAYS: '5',
        EXECUTION_RETENTION_DAYS: '9',
        AUTH_DATA_RETENTION_DAYS: '2'
      }).lifecycle
    ).toEqual({
      isEnabled: true,
      intervalMs: 1000,
      unverifiedDays: 3,
      inactiveDays: 0,
      noticeDays: 5,
      executionDays: 9,
      authDays: 2,
      activityDays: 400
    })
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).lifecycle.isEnabled).toBe(false)
    expect(loadConfig({ ...base, NODE_ENV: 'test', LIFECYCLE_ENABLED: 'true' }).lifecycle.isEnabled).toBe(true)
    expect(loadConfig({ ...base, INACTIVE_ACCOUNT_DAYS: 'x' }).lifecycle.inactiveDays).toBe(365)
  })

  it('reads the admin console settings and takes the secret from the admin, then the access, secret', () => {
    const admin = loadConfig({
      ...base,
      ADMIN_IP_ALLOWLIST: '10.0.0.1, 10.0.0.2',
      ADMIN_2FA_TTL: '2h',
      ADMIN_TOTP_ISSUER: 'Bot RTS',
      ADMIN_RECOVERY_CODES: '5',
      ADMIN_SECRET: 'admin-secret',
      ADMIN_BAN_CHECK_MS: '5000',
      ADMIN_VIEW_AS_TTL: '10m',
      JWT_ACCESS_SECRET: 'access'
    }).admin

    expect(admin).toEqual({
      ipAllowList: ['10.0.0.1', '10.0.0.2'],
      verificationTtlMs: 2 * 60 * 60 * 1000,
      totpIssuer: 'Bot RTS',
      recoveryCodeCount: 5,
      secret: 'admin-secret',
      banCheckIntervalMs: 5000,
      viewAsTtlMs: 10 * 60 * 1000
    })
    expect(loadConfig({ ...base, JWT_ACCESS_SECRET: 'access' }).admin.secret).toBe('access')
    expect(() => loadConfig({ ...base, ADMIN_2FA_TTL: 'soon' })).toThrow('ADMIN_2FA_TTL')
  })

  it('reads the monitoring settings, and keeps the sampler off in tests', () => {
    const monitoring = loadConfig({
      ...base,
      MONITORING_INTERVAL_MS: '5000',
      MONITORING_FINE_RETENTION: '1d',
      MONITORING_COARSE_RETENTION: '10d',
      ADMIN_ALERT_EMAILS: 'a@x.io, b@x.io',
      ADMIN_ALERT_THRESHOLDS: '{"api.errorRate5xx":{"yellow":0.02,"red":0.1}}'
    }).monitoring

    expect(monitoring).toMatchObject({
      sampleIntervalMs: 5000,
      fineRetentionMs: 86_400_000,
      coarseRetentionMs: 864_000_000,
      alertEmails: ['a@x.io', 'b@x.io'],
      thresholds: { 'api.errorRate5xx': { yellow: 0.02, red: 0.1 } }
    })
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).monitoring.isEnabled).toBe(false)
    expect(loadConfig({ ...base, NODE_ENV: 'test', MONITORING_ENABLED: 'true' }).monitoring.isEnabled).toBe(true)
  })

  it.each([
    'not json',
    '{"unknown.metric":{"red":1}}',
    '{"api.errorRate5xx":{"orange":1}}',
    '{"api.errorRate5xx":{"red":"x"}}',
    'null'
  ])('rejects the alert thresholds %s', (raw) => {
    expect(() => loadConfig({ ...base, ADMIN_ALERT_THRESHOLDS: raw })).toThrow('ADMIN_ALERT_THRESHOLDS')
  })

  it('remembers a token owner for 2 s outside tests, and reads the setting', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).auth.principalCacheMs).toBe(0)
    expect(loadConfig({ ...base, AUTH_CACHE_TTL_MS: '500' }).auth.principalCacheMs).toBe(500)
    expect(loadConfig({ ...base, AUTH_CACHE_TTL_MS: '0' }).auth.principalCacheMs).toBe(0)
  })
})
