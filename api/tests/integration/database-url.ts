export const DEFAULT_DATABASE_URL = 'postgresql://botrts:botrts@localhost:5432/botrts'
export const TEMPLATE_DATABASE = 'botrts_template'

export function baseDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL
}

// The same server and credentials, another database
export function urlForDatabase(database: string): string {
  const url = new URL(baseDatabaseUrl())
  url.pathname = `/${database}`
  return url.toString()
}
