import { AuthPolicy, DEFAULT_AUTH_POLICY } from '../auth/domain/auth-policy'
import { WorldConfig } from '../map/domain/world-config'
import { convertTimeStringToMilliseconds } from '../shared/domain/duration'
import { SpawnConfig } from '../spawn/domain/spawn-config'
import { CraftingConfig } from '../crafting/domain/crafting-config'
import { readCraftingConfig } from '../crafting/infrastructure/crafting-config.reader'
import { readSpawnConfig } from '../spawn/infrastructure/spawn-config.reader'
import { readWorldConfig } from '../map/infrastructure/world-config.reader'
import { DEFAULT_TERMINAL_RETENTION, TerminalRetention } from '../terminal/domain/terminal-retention'
import { readSmtpConfig, SmtpConfig } from '../notifications/infrastructure/smtp-config'

export const APP_CONFIG = Symbol('AppConfig')

export type NodeEnv = 'development' | 'test' | 'production'

export interface AuthConfig {
  // Which identity adapter verifies tokens (AGENTS.md §3.3); `local` is the custom email + password provider
  provider: 'local'
  accessSecret: string
  accessTtlSeconds: number
  policy: AuthPolicy
}

export interface RateLimitConfig {
  windowMs: number
  // Requests per window for the sensitive auth routes (register, login, refresh, password and email flows)
  authMax: number
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
  terminal: TerminalRetention
  smtp: SmtpConfig | undefined
  // A directory that receives every outgoing email as a JSON file, for end-to-end tests; unset in normal operation
  emailOutboxDir: string | undefined
  auth: AuthConfig
  rateLimit: RateLimitConfig
  // Trust X-Forwarded-* headers of a reverse proxy (needed for per-client rate limits behind one)
  trustProxy: boolean
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

  const world = readWorldConfig(env, problems)
  const crafting = readCraftingConfig(env, problems)

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
    terminal: {
      logDays: positiveInt(env.TERMINAL_LOG_RETENTION_DAYS, DEFAULT_TERMINAL_RETENTION.logDays),
      maxLinesPerBot: positiveInt(env.TERMINAL_LOG_MAX_LINES, DEFAULT_TERMINAL_RETENTION.maxLinesPerBot),
      securityDays: positiveInt(env.TERMINAL_SECURITY_RETENTION_DAYS, DEFAULT_TERMINAL_RETENTION.securityDays)
    },
    smtp: readSmtpConfig(env),
    emailOutboxDir: env.EMAIL_OUTBOX_DIR || undefined,
    auth: {
      provider: provider as AuthConfig['provider'],
      accessSecret: env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET,
      accessTtlSeconds: Math.floor(accessTtl / 1000),
      policy: { ...DEFAULT_AUTH_POLICY, sessionTtlMs: sessionTtl }
    },
    rateLimit: { windowMs: rateWindow, authMax: positiveInt(env.RATE_LIMIT_AUTH_MAX, 20) },
    trustProxy: env.TRUST_PROXY === 'true'
  }
}
