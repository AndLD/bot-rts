import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { TEMPLATE_DATABASE, urlForDatabase } from './database-url'

const TABLES = [
  'terminal_logs',
  'terminal_sessions',
  'known_points',
  'map_points',
  'files',
  'modules',
  'bots',
  'auth_tokens',
  'sessions',
  'local_credentials',
  'identities',
  'users'
]

export interface TestDatabase {
  client: PrismaClient
  reset(): Promise<void>
  drop(): Promise<void>
}

// A private database cloned from the migrated template; one per test file, so Jest workers never share state
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `botrts_test_${randomUUID().replace(/-/g, '')}`
  const admin = new PrismaClient({ datasourceUrl: urlForDatabase('postgres') })

  await admin.$executeRawUnsafe(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`)

  const client = new PrismaClient({ datasourceUrl: urlForDatabase(name) })

  return {
    client,
    reset: async () => {
      await client.$executeRawUnsafe(`TRUNCATE ${TABLES.join(', ')} CASCADE`)
    },
    drop: async () => {
      await client.$disconnect()
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await admin.$disconnect()
    }
  }
}
