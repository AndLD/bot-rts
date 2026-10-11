import { WorldConfig } from '../map/domain/world-config'
import { readWorldConfig } from '../map/infrastructure/world-config.reader'
import { readSmtpConfig, SmtpConfig } from '../notifications/infrastructure/smtp-config'

export const APP_CONFIG = Symbol('AppConfig')

export type NodeEnv = 'development' | 'test' | 'production'

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
  smtp: SmtpConfig | undefined
}

type Env = Record<string, string | undefined>

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
  }
}

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production']
// Secrets of the JWT module that must be set explicitly in production (it falls back to dev values otherwise)
const PRODUCTION_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EMAIL_VERIFICATION_SECRET']

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

  if (nodeEnv === 'production') {
    for (const name of PRODUCTION_SECRETS) {
      if (!env[name]) {
        problems.push(`${name} is required in production`)
      }
    }
  }

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
    world: readWorldConfig(env),
    smtp: readSmtpConfig(env)
  }
}
