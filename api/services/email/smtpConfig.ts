export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

type Env = Record<string, string | undefined>

const DEV_DEFAULT_HOST = 'smtp.gmail.com'
const DEFAULT_PORT = 465

export function readSmtpConfig(env: Env): SmtpConfig | undefined {
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  const host = env.SMTP_HOST || (env.NODE_ENV === 'production' ? undefined : DEV_DEFAULT_HOST)

  if (!user || !pass || !host) {
    return undefined
  }

  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : DEFAULT_PORT

  if (!Number.isInteger(port) || port <= 0) {
    return undefined
  }

  return {
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === DEFAULT_PORT,
    user,
    pass
  }
}
