import { AuthPolicy, DEFAULT_AUTH_POLICY } from '../auth/domain/auth-policy'
import { WorldConfig } from '../map/domain/world-config'
import { convertTimeStringToMilliseconds } from '../shared/domain/duration'
import { SpawnConfig } from '../spawn/domain/spawn-config'
import { CraftingConfig } from '../crafting/domain/crafting-config'
import { readCraftingConfig } from '../crafting/infrastructure/crafting-config.reader'
import { readSpawnConfig } from '../spawn/infrastructure/spawn-config.reader'
import { readWorldConfig } from '../map/infrastructure/world-config.reader'
import { BotSecurityPolicy, DEFAULT_BOT_SECURITY } from '../terminal/domain/bot-security'
import { DEFAULT_TERMINAL_RETENTION, TerminalRetention } from '../terminal/domain/terminal-retention'
import {
  DEFAULT_PLAYER_NOTIFICATIONS,
  PlayerNotificationsConfig
} from '../player-notifications/domain/notification-policy'
import { readSmtpConfig, SmtpConfig } from '../notifications/infrastructure/smtp-config'
import { DEFAULT_LIFECYCLE_POLICY, LifecyclePolicy } from '../lifecycle/domain/lifecycle-policy'
import { BalanceConfig } from '../balance/domain/balance'
import { ALERT_RULES } from '../monitoring/domain/metric-catalog'
import { invalidOrigins } from '../shared/presentation/origin-matcher'
import { EngineSettings, readEngineSettings } from '../engine/infrastructure/engine-config.reader'

export const APP_CONFIG = Symbol('AppConfig')

export type NodeEnv = 'development' | 'test' | 'production'

export type CookieSameSite = 'lax' | 'strict' | 'none'

export interface AuthConfig {
  // Which identity adapter verifies tokens (AGENTS.md §3.3); `local` is the custom email + password provider
  provider: 'local'
  accessSecret: string
  accessTtlSeconds: number
  policy: AuthPolicy
  // How long a token's owner is remembered between requests (0: not at all); a ban takes effect this much later
  principalCacheMs: number
  cookie: {
    // `none` lets a web client on another site (a preview deployment) use the cookie; on one registrable domain `lax` is enough
    sameSite: CookieSameSite
    // Set to the shared parent domain (example.com) to let the cookie reach sibling hosts; empty: the API host only
    domain: string | undefined
  }
}

export interface RateLimitConfig {
  windowMs: number
  // Requests per window for the sensitive auth routes (register, login, refresh, password and email flows)
  authMax: number
  // Every other route: requests per window per client address (a floor against floods, not a game rule)
  apiWindowMs: number
  apiMax: number
}

export interface HttpConfig {
  // Largest JSON request body
  bodyLimitBytes: number
  // A handler that does not answer within this time is cut off with 503 REQUEST_TIMEOUT
  handlerTimeoutMs: number
  // Node's limits against slow clients: the whole request, its headers, and an idle keep-alive connection
  requestTimeoutMs: number
  headersTimeoutMs: number
  keepAliveTimeoutMs: number
}

// What a process of the API tier does (docs: deployment). `all` runs the API and the engine thread in one process; `api`
// serves HTTP and sockets and reaches the one engine through Redis; `engine` is the process that owns the engine and
// answers the API nodes (it serves HTTP and sockets too, so a small deployment can run one `engine` node next to `api` nodes).
export type AppRole = 'all' | 'api' | 'engine'

export interface DeploymentConfig {
  role: AppRole
  // Needed by the roles `api` and `engine`; with it set, Socket.IO uses the Redis adapter so several nodes share rooms
  redisUrl: string | undefined
  // How long an API node waits for the engine node to answer
  engineRequestTimeoutMs: number
}

// The test-only tools of the admin console; the configuration refuses them in production
export interface DevToolsConfig {
  isEnabled: boolean
}

export interface ObservabilityConfig {
  // Bearer token of GET /api/v1/metrics; without one the endpoint answers 404
  metricsToken: string | undefined
  // How many of the newest log lines are kept in memory for the admin console
  logBufferSize: number
  // `json` (one object per line, for log collectors) or `text`; json by default in production
  logFormat: 'json' | 'text'
  // Whether the log also goes to a file in `logs/` (development); containers log to the console only
  isLogFileEnabled: boolean
  // The OTLP endpoint of the collector gateway (design §25.3); without one nothing is exported and the console and the files remain
  otlpEndpoint: string | undefined
  // Headers sent with every export, for example the bearer token of the gateway (`OTEL_EXPORTER_OTLP_HEADERS`)
  otlpHeaders: Record<string, string>
  // The share of new traces that are recorded and exported (parent-based: a trace that was started elsewhere keeps its decision)
  traceSampleRatio: number
  // Where the console's log search reads: `memory` (the recent lines of the node that answers) or `elasticsearch` (the lines of every node)
  logStore: 'memory' | 'elasticsearch'
  // The Elasticsearch the log search reads, with a read-only account: an API key, or a user and a password
  elasticsearchUrl: string | undefined
  elasticsearchApiKey: string | undefined
  elasticsearchUsername: string | undefined
  elasticsearchPassword: string | undefined
  // The data stream the gateway writes the logs to, and the limits of a search: how long it may take, and how wide a time range
  logIndex: string
  // The data stream the gateway writes the spans to
  traceIndex: string
  logSearchTimeoutMs: number
  logSearchMaxWindowDays: number
  // How long the log store keeps logs and traces (the default of the console's retention setting), in days
  logRetentionDays: number
  // An account that may change the lifecycle policy of the log store, used only when an admin changes the retention of the logs; without
  // one the setting is kept but not applied
  elasticsearchAdminApiKey: string | undefined
  elasticsearchAdminUsername: string | undefined
  elasticsearchAdminPassword: string | undefined
  // Where the console reads the health and the queue size of the gateway collector (its health-check extension and its Prometheus
  // metrics); without them the console shows no gateway metrics
  gatewayHealthUrl: string | undefined
  gatewayMetricsUrl: string | undefined
  // How many records and spans the exporters hold while the gateway is slow or away; further ones are dropped
  exportQueueSize: number
  // The file the backup job writes when it finishes, which the Operations page of the console reads; undefined: not reported
  backupStatusFile: string | undefined
}

export interface AdminConfig {
  // Addresses the console may be used from; empty: any (design §25.2)
  ipAllowList: string[]
  // How long a session stays verified by the second factor
  verificationTtlMs: number
  // The name an authenticator app shows for the account
  totpIssuer: string
  recoveryCodeCount: number
  // Encrypts the TOTP secrets at rest
  secret: string
  // How often bans whose time has passed are lifted
  banCheckIntervalMs: number
  // How long a "view as player" session lasts at most (design §25.2)
  viewAsTtlMs: number
}

export interface MonitoringConfig {
  // Whether this process samples its metrics; the integration tests drive the sampler by hand
  isEnabled: boolean
  sampleIntervalMs: number
  // History: the finest resolution is the sample interval; the coarse tier keeps one-minute averages (design §25.5)
  fineRetentionMs: number
  coarseStepMs: number
  coarseRetentionMs: number
  // Where the history is kept: `memory` (this process only, as before) or `postgres` (the coarse tier of every node in the database,
  // so the console sees all nodes). Postgres is the default in production and on a node of a scaled deployment.
  history: 'memory' | 'postgres'
  // A database query that takes at least this long (ms) is slow: counted, and the last few are kept for the console
  slowQueryMs: number
  // Who is emailed about a red alert
  alertEmails: string[]
  // Overrides of the default alert thresholds, by metric id
  thresholds: Record<string, { yellow?: number; red?: number }>
}

// The balance an admin can edit (design §25.3): what the server starts with before any version is laid over it, the version laid over
// it now, and why a stored version could not be used
export interface BalanceSettings {
  base: BalanceConfig
  version: number | null
  problem: string | null
}

export interface AppConfig {
  nodeEnv: NodeEnv
  port: number
  databaseUrl: string
  frontendUrl: string
  adminUrl: string
  // Origins allowed by CORS
  corsOrigins: string[]
  worldSeed: number | undefined
  world: WorldConfig
  spawn: SpawnConfig
  crafting: CraftingConfig
  engine: EngineSettings
  terminal: TerminalRetention
  botSecurity: BotSecurityPolicy
  notifications: PlayerNotificationsConfig
  smtp: SmtpConfig | undefined
  // A directory that receives every outgoing email as a JSON file, for end-to-end tests; unset in normal operation
  emailOutboxDir: string | undefined
  auth: AuthConfig
  rateLimit: RateLimitConfig
  http: HttpConfig
  // Trust X-Forwarded-* headers of a reverse proxy (needed for per-client rate limits behind one)
  trustProxy: boolean
  deployment: DeploymentConfig
  observability: ObservabilityConfig
  lifecycle: LifecyclePolicy
  admin: AdminConfig
  // How long a node keeps the switches of the features it read (design §25.3)
  featureSwitchCacheMs: number
  monitoring: MonitoringConfig
  balance: BalanceSettings
  devTools: DevToolsConfig
}

type Env = Record<string, string | undefined>

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
  }
}

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production']
const AUTH_PROVIDERS = ['local'] as const
const COOKIE_SAME_SITES: readonly CookieSameSite[] = ['lax', 'strict', 'none']
const APP_ROLES: readonly AppRole[] = ['all', 'api', 'engine']
const DEV_ACCESS_SECRET = 'development-only-access-secret'

// "10m", "24h", "30d" or "500ms" -> milliseconds; a malformed value is reported as a problem
function duration(value: string | undefined, fallback: string, name: string, problems: string[]): number {
  const ms = convertTimeStringToMilliseconds(value || fallback)

  if (ms <= 0) {
    problems.push(`${name} must be a duration like 10m, 24h or 30d`)
  }

  return ms
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

// 0 is a valid value for a few settings (it switches the feature off)
function nonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return value !== undefined && value !== '' && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// A share between 0 and 1 (1 records every new trace, 0 none)
function ratio(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? Number.NaN : Number(value)
  return parsed >= 0 && parsed <= 1 ? parsed : fallback
}

// `name=value,name2=value2`, the form of OTEL_EXPORTER_OTLP_HEADERS
function headerList(value: string | undefined): Record<string, string> {
  return Object.fromEntries(
    list(value)
      .map((pair): [string, string] => [
        pair.slice(0, pair.indexOf('=')).trim(),
        pair.slice(pair.indexOf('=') + 1).trim()
      ])
      .filter(([name]) => name !== '')
  )
}

// ADMIN_ALERT_THRESHOLDS: {"api.errorRate5xx":{"yellow":0.02,"red":0.1}} overrides the defaults of those metrics
function readThresholds(raw: string | undefined, problems: string[]): MonitoringConfig['thresholds'] {
  if (!raw) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    const entries = Object.entries(parsed as Record<string, Record<string, unknown>>)
    const valid = entries.every(
      ([metric, limits]) =>
        ALERT_RULES.some((rule) => rule.metric === metric) &&
        Object.entries(limits).every(([level, value]) => ['yellow', 'red'].includes(level) && typeof value === 'number')
    )
    if (valid && parsed && typeof parsed === 'object') {
      return parsed as MonitoringConfig['thresholds']
    }
  } catch {
    // reported below
  }
  problems.push(
    'ADMIN_ALERT_THRESHOLDS must be JSON like {"api.errorRate5xx":{"yellow":0.02,"red":0.1}} for known metrics'
  )

  return {}
}

// Reads the environment into a typed, validated configuration; throws one ConfigError listing every problem
export function loadConfig(env: Env): AppConfig {
  const problems: string[] = []
  const nodeEnv = (env.NODE_ENV || 'development') as NodeEnv

  if (!NODE_ENVS.includes(nodeEnv)) {
    problems.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}`)
  }

  const port = env.PORT === undefined || env.PORT === '' ? 8080 : Number(env.PORT)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    problems.push('PORT must be an integer between 0 and 65535')
  }

  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    problems.push('DATABASE_URL must be a postgresql:// connection string')
  }

  const adminVerificationTtl = duration(env.ADMIN_2FA_TTL, '8h', 'ADMIN_2FA_TTL', problems)

  const fineRetention = duration(env.MONITORING_FINE_RETENTION, '7d', 'MONITORING_FINE_RETENTION', problems)
  const coarseRetention = duration(env.MONITORING_COARSE_RETENTION, '30d', 'MONITORING_COARSE_RETENTION', problems)
  const thresholds = readThresholds(env.ADMIN_ALERT_THRESHOLDS, problems)

  if (nodeEnv === 'production' && !env.JWT_ACCESS_SECRET) {
    problems.push('JWT_ACCESS_SECRET is required in production')
  }

  if (nodeEnv === 'production' && env.DEV_TOOLS_ENABLED === 'true') {
    problems.push('DEV_TOOLS_ENABLED must not be set in production')
  }

  const provider = env.AUTH_PROVIDER || 'local'
  if (!AUTH_PROVIDERS.includes(provider as (typeof AUTH_PROVIDERS)[number])) {
    problems.push(`AUTH_PROVIDER must be one of ${AUTH_PROVIDERS.join(', ')}`)
  }

  const accessTtl = duration(env.JWT_ACCESS_EXPIRES_IN, '10m', 'JWT_ACCESS_EXPIRES_IN', problems)
  const sessionTtl = duration(env.JWT_REFRESH_EXPIRES_IN, '30d', 'JWT_REFRESH_EXPIRES_IN', problems)
  const rateWindow = duration(
    env.RATE_LIMIT_WINDOW_MS ? `${env.RATE_LIMIT_WINDOW_MS}ms` : undefined,
    '15m',
    'RATE_LIMIT_WINDOW_MS',
    problems
  )

  const monitoringHistory =
    env.MONITORING_HISTORY ||
    (env.NODE_ENV === 'production' || (env.APP_ROLE || 'all') !== 'all' ? 'postgres' : 'memory')
  if (monitoringHistory !== 'memory' && monitoringHistory !== 'postgres') {
    problems.push('MONITORING_HISTORY must be memory or postgres')
  }
  const logStore = env.LOG_STORE || 'memory'
  if (logStore !== 'memory' && logStore !== 'elasticsearch') {
    problems.push('LOG_STORE must be memory or elasticsearch')
  }
  if (logStore === 'elasticsearch' && !env.ELASTICSEARCH_URL) {
    problems.push('ELASTICSEARCH_URL is required when LOG_STORE is elasticsearch')
  }
  const role = (env.APP_ROLE || 'all') as AppRole
  if (!APP_ROLES.includes(role)) {
    problems.push(`APP_ROLE must be one of ${APP_ROLES.join(', ')}`)
  }
  problems.push(...invalidOrigins(list(env.WHITELIST_URLS)).map((problem) => `WHITELIST_URLS: ${problem}`))
  const sameSite = env.COOKIE_SAME_SITE
  if (sameSite !== undefined && sameSite !== '' && !COOKIE_SAME_SITES.includes(sameSite as CookieSameSite)) {
    problems.push(`COOKIE_SAME_SITE must be one of ${COOKIE_SAME_SITES.join(', ')}`)
  }
  const redisUrl = env.REDIS_URL || undefined
  if (role !== 'all' && !redisUrl) {
    problems.push(`REDIS_URL is required when APP_ROLE is ${role}`)
  }
  if (redisUrl && !/^rediss?:\/\//.test(redisUrl)) {
    problems.push('REDIS_URL must be a redis:// connection string')
  }

  const world = readWorldConfig(env, problems)
  const crafting = readCraftingConfig(env, problems)
  const engine = readEngineSettings(env, nodeEnv === 'test', problems)

  if (problems.length) {
    throw new ConfigError(problems)
  }

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173'
  const seed = Number(env.WORLD_SEED)

  return {
    nodeEnv,
    port,
    databaseUrl: env.DATABASE_URL as string,
    frontendUrl,
    adminUrl: env.ADMIN_URL || frontendUrl,
    corsOrigins: list(env.WHITELIST_URLS).length ? list(env.WHITELIST_URLS) : [frontendUrl],
    worldSeed: Number.isFinite(seed) && env.WORLD_SEED ? seed : undefined,
    world,
    spawn: readSpawnConfig(env),
    crafting,
    engine,
    terminal: {
      logDays: positiveInt(env.TERMINAL_LOG_RETENTION_DAYS, DEFAULT_TERMINAL_RETENTION.logDays),
      maxLinesPerBot: positiveInt(env.TERMINAL_LOG_MAX_LINES, DEFAULT_TERMINAL_RETENTION.maxLinesPerBot),
      securityDays: positiveInt(env.TERMINAL_SECURITY_RETENTION_DAYS, DEFAULT_TERMINAL_RETENTION.securityDays)
    },
    botSecurity: {
      attemptEnergy: positiveInt(env.BOT_ATTEMPT_ENERGY, DEFAULT_BOT_SECURITY.attemptEnergy),
      attemptDelayMs: positiveInt(env.BOT_ATTEMPT_DELAY_MS, DEFAULT_BOT_SECURITY.attemptDelayMs),
      maxFailures: positiveInt(env.BOT_LOCKOUT_FAILURES, DEFAULT_BOT_SECURITY.maxFailures),
      lockoutMs: positiveInt(env.BOT_LOCKOUT_MS, DEFAULT_BOT_SECURITY.lockoutMs)
    },
    notifications: {
      retentionDays: positiveInt(env.NOTIFICATION_RETENTION_DAYS, DEFAULT_PLAYER_NOTIFICATIONS.retentionDays),
      coalesceMs: positiveInt(env.NOTIFICATION_COALESCE_MS, DEFAULT_PLAYER_NOTIFICATIONS.coalesceMs),
      capPerMinute: positiveInt(env.NOTIFICATION_CAP_PER_MINUTE, DEFAULT_PLAYER_NOTIFICATIONS.capPerMinute)
    },
    smtp: readSmtpConfig(env),
    emailOutboxDir: env.EMAIL_OUTBOX_DIR || undefined,
    auth: {
      provider: provider as AuthConfig['provider'],
      accessSecret: env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET,
      accessTtlSeconds: Math.floor(accessTtl / 1000),
      policy: { ...DEFAULT_AUTH_POLICY, sessionTtlMs: sessionTtl },
      principalCacheMs: nonNegativeInt(env.AUTH_CACHE_TTL_MS, nodeEnv === 'test' ? 0 : 2000),
      cookie: {
        sameSite: (sameSite || (nodeEnv === 'production' ? 'none' : 'lax')) as CookieSameSite,
        domain: env.COOKIE_DOMAIN || undefined
      }
    },
    rateLimit: {
      windowMs: rateWindow,
      authMax: positiveInt(env.RATE_LIMIT_AUTH_MAX, 20),
      apiWindowMs: positiveInt(env.RATE_LIMIT_API_WINDOW_MS, 60_000),
      apiMax: positiveInt(env.RATE_LIMIT_API_MAX, 600)
    },
    http: {
      bodyLimitBytes: positiveInt(env.HTTP_BODY_LIMIT_BYTES, 256 * 1024),
      handlerTimeoutMs: positiveInt(env.HTTP_HANDLER_TIMEOUT_MS, 30_000),
      requestTimeoutMs: positiveInt(env.HTTP_REQUEST_TIMEOUT_MS, 60_000),
      headersTimeoutMs: positiveInt(env.HTTP_HEADERS_TIMEOUT_MS, 15_000),
      keepAliveTimeoutMs: positiveInt(env.HTTP_KEEP_ALIVE_TIMEOUT_MS, 65_000)
    },
    trustProxy: env.TRUST_PROXY === 'true',
    lifecycle: {
      isEnabled: env.LIFECYCLE_ENABLED ? env.LIFECYCLE_ENABLED === 'true' : nodeEnv !== 'test',
      intervalMs: positiveInt(env.LIFECYCLE_INTERVAL_MS, DEFAULT_LIFECYCLE_POLICY.intervalMs),
      unverifiedDays: positiveInt(env.UNVERIFIED_ACCOUNT_DAYS, DEFAULT_LIFECYCLE_POLICY.unverifiedDays),
      inactiveDays: nonNegativeInt(env.INACTIVE_ACCOUNT_DAYS, DEFAULT_LIFECYCLE_POLICY.inactiveDays),
      noticeDays: positiveInt(env.INACTIVE_ACCOUNT_NOTICE_DAYS, DEFAULT_LIFECYCLE_POLICY.noticeDays),
      executionDays: positiveInt(env.EXECUTION_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.executionDays),
      authDays: positiveInt(env.AUTH_DATA_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.authDays),
      activityDays: positiveInt(env.PLAYER_ACTIVITY_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.activityDays)
    },
    featureSwitchCacheMs: nonNegativeInt(env.FEATURE_SWITCH_CACHE_MS, nodeEnv === 'test' ? 0 : 5000),
    admin: {
      ipAllowList: list(env.ADMIN_IP_ALLOWLIST),
      verificationTtlMs: adminVerificationTtl,
      totpIssuer: env.ADMIN_TOTP_ISSUER || 'BotRTS',
      recoveryCodeCount: positiveInt(env.ADMIN_RECOVERY_CODES, 8),
      secret: env.ADMIN_SECRET || env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET,
      banCheckIntervalMs: positiveInt(env.ADMIN_BAN_CHECK_MS, 60_000),
      viewAsTtlMs: duration(env.ADMIN_VIEW_AS_TTL, '30m', 'ADMIN_VIEW_AS_TTL', problems)
    },
    monitoring: {
      isEnabled: env.MONITORING_ENABLED ? env.MONITORING_ENABLED === 'true' : nodeEnv !== 'test',
      sampleIntervalMs: positiveInt(env.MONITORING_INTERVAL_MS, 10_000),
      fineRetentionMs: fineRetention,
      coarseStepMs: 60_000,
      coarseRetentionMs: coarseRetention,
      history: monitoringHistory as 'memory' | 'postgres',
      slowQueryMs: positiveInt(env.SLOW_QUERY_MS, 200),
      alertEmails: list(env.ADMIN_ALERT_EMAILS),
      thresholds
    },
    balance: { base: { resources: world.resources, crafting }, version: null, problem: null },
    devTools: { isEnabled: env.DEV_TOOLS_ENABLED === 'true' },
    observability: {
      metricsToken: env.METRICS_TOKEN || undefined,
      logBufferSize: positiveInt(env.LOG_BUFFER_SIZE, 5000),
      logFormat:
        env.LOG_FORMAT === 'json' || env.LOG_FORMAT === 'text'
          ? env.LOG_FORMAT
          : nodeEnv === 'production'
            ? 'json'
            : 'text',
      // Production writes to the console (and the gateway) only; a file is for development, or asked for with LOG_FILE=true
      isLogFileEnabled:
        env.LOG_FILE === undefined || env.LOG_FILE === '' ? nodeEnv !== 'production' : env.LOG_FILE === 'true',
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
      otlpHeaders: headerList(env.OTEL_EXPORTER_OTLP_HEADERS),
      traceSampleRatio: ratio(env.OTEL_TRACES_SAMPLER_ARG, 1),
      exportQueueSize: positiveInt(env.OTEL_EXPORT_QUEUE_SIZE, 2048),
      logStore: logStore as 'memory' | 'elasticsearch',
      elasticsearchUrl: env.ELASTICSEARCH_URL || undefined,
      elasticsearchApiKey: env.ELASTICSEARCH_API_KEY || undefined,
      elasticsearchUsername: env.ELASTICSEARCH_USERNAME || undefined,
      elasticsearchPassword: env.ELASTICSEARCH_PASSWORD || undefined,
      logIndex: env.LOG_INDEX || 'botrts-logs',
      traceIndex: env.TRACE_INDEX || 'botrts-traces',
      logSearchTimeoutMs: positiveInt(env.LOG_SEARCH_TIMEOUT_MS, 5000),
      logSearchMaxWindowDays: positiveInt(env.LOG_SEARCH_MAX_WINDOW_DAYS, 7),
      logRetentionDays: positiveInt(env.LOG_RETENTION_DAYS, 14),
      elasticsearchAdminApiKey: env.ELASTICSEARCH_ADMIN_API_KEY || undefined,
      elasticsearchAdminUsername: env.ELASTICSEARCH_ADMIN_USERNAME || undefined,
      elasticsearchAdminPassword: env.ELASTICSEARCH_ADMIN_PASSWORD || undefined,
      gatewayHealthUrl: env.OTEL_GATEWAY_HEALTH_URL || undefined,
      gatewayMetricsUrl: env.OTEL_GATEWAY_METRICS_URL || undefined,
      backupStatusFile: env.BACKUP_STATUS_FILE || undefined
    },
    deployment: {
      role,
      redisUrl,
      engineRequestTimeoutMs: positiveInt(env.ENGINE_REQUEST_TIMEOUT_MS, 15_000)
    }
  }
}
