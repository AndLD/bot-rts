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
import { EngineSettings, readEngineSettings } from '../engine/infrastructure/engine-config.reader'

export const APP_CONFIG = Symbol('AppConfig')

export type NodeEnv = 'development' | 'test' | 'production'

export interface AuthConfig {
  // Which identity adapter verifies tokens (AGENTS.md §3.3); `local` is the custom email + password provider
  provider: 'local'
  accessSecret: string
  accessTtlSeconds: number
  policy: AuthPolicy
  // How long a token's owner is remembered between requests (0: not at all); a ban takes effect this much later
  principalCacheMs: number
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

export interface ObservabilityConfig {
  // Bearer token of GET /api/v1/metrics; without one the endpoint answers 404
  metricsToken: string | undefined
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

  if (nodeEnv === 'production' && !env.JWT_ACCESS_SECRET) {
    problems.push('JWT_ACCESS_SECRET is required in production')
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

  const role = (env.APP_ROLE || 'all') as AppRole
  if (!APP_ROLES.includes(role)) {
    problems.push(`APP_ROLE must be one of ${APP_ROLES.join(', ')}`)
  }
  if (list(env.WHITELIST_URLS).includes('*')) {
    problems.push('WHITELIST_URLS must list origins; * is not allowed because the API uses credentials')
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
      principalCacheMs: nonNegativeInt(env.AUTH_CACHE_TTL_MS, nodeEnv === 'test' ? 0 : 2000)
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
      authDays: positiveInt(env.AUTH_DATA_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.authDays)
    },
    observability: { metricsToken: env.METRICS_TOKEN || undefined },
    deployment: {
      role,
      redisUrl,
      engineRequestTimeoutMs: positiveInt(env.ENGINE_REQUEST_TIMEOUT_MS, 15_000)
    }
  }
}
