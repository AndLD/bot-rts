import { PrismaClient } from '@prisma/client'
import { templateDatabase, urlForDatabase } from './database-url'

// Drops the template database that global-setup.ts built for this run
export default async function globalTeardown() {
  const admin = new PrismaClient({ datasourceUrl: urlForDatabase('postgres') })

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${templateDatabase()} WITH (FORCE)`)
  } finally {
    await admin.$disconnect()
  }
}
