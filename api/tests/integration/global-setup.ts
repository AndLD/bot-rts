import { execFileSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { urlForDatabase } from './database-url'

// Builds the template database once per run by applying every migration to an empty database, which doubles as the
// "migrations apply cleanly" check. Each test file then clones the template, which takes milliseconds.
export default async function globalSetup() {
  const template = `botrts_template_${randomUUID().replace(/-/g, '')}`
  process.env.BOTRTS_TEMPLATE_DATABASE = template
  const admin = new PrismaClient({ datasourceUrl: urlForDatabase('postgres') })

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${template} WITH (FORCE)`)
    await admin.$executeRawUnsafe(`CREATE DATABASE ${template}`)
  } finally {
    await admin.$disconnect()
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: __dirname + '/../..',
    env: { ...process.env, DATABASE_URL: urlForDatabase(template) },
    stdio: 'pipe'
  })
}
