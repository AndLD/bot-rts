export const DEFAULT_DATABASE_URL = 'postgresql://botrts:botrts@localhost:5432/botrts'
// Each test run builds its own template database (see global-setup.ts) and tells the workers its name through the
// environment, so that two runs on one PostgreSQL server (a push hook and a test run, for example) never meet
export function templateDatabase(): string {
  return process.env.BOTRTS_TEMPLATE_DATABASE || 'botrts_template'
}

export function baseDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL
}

// The same server and credentials, another database
export function urlForDatabase(database: string): string {
  const url = new URL(baseDatabaseUrl())
  url.pathname = `/${database}`
  return url.toString()
}
