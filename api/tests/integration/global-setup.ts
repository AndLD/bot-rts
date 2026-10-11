import { execFileSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { TEMPLATE_DATABASE, urlForDatabase } from './database-url'

// Builds the template database once per run by applying every migration to an empty database, which doubles as the
// "migrations apply cleanly" check. Each test file then clones the template, which takes milliseconds.
export default async function globalSetup() {
  const admin = new PrismaClient({ datasourceUrl: urlForDatabase('postgres') })

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${TEMPLATE_DATABASE} WITH (FORCE)`)
    await admin.$executeRawUnsafe(`CREATE DATABASE ${TEMPLATE_DATABASE}`)
  } finally {
    await admin.$disconnect()
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: __dirname + '/../..',
    env: { ...process.env, DATABASE_URL: urlForDatabase(TEMPLATE_DATABASE) },
    stdio: 'pipe'
  })
}
