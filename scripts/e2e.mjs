// Runs the Cypress suite against a throwaway stack: a fresh PostgreSQL database, the API (ts-node) and the built client.
// Usage: node scripts/e2e.mjs [--open] [--skip-build] [-- <cypress run arguments>]
// Needs the PostgreSQL of docker-compose.yml (`npm run db:up`) or a service container with the same credentials.
// It uses ports other than the development servers' (E2E_API_PORT, E2E_CLIENT_PORT), refuses to start when one is taken, and stops only
// what it started. Two checkouts: give each its own database port (POSTGRES_PORT) and e2e ports (docs/testing/README.md).
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { portsInUse } from './e2e-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const workDir = resolve(root, '.e2e')
const outbox = resolve(workDir, 'outbox')
const adminUrl =
  process.env.E2E_ADMIN_DATABASE_URL ??
  `postgresql://botrts:botrts@localhost:${process.env.POSTGRES_PORT ?? 5432}/postgres`

const args = process.argv.slice(2)
const isOpen = args.includes('--open')
const shouldBuild = !args.includes('--skip-build')
const cypressArgs = args.includes('--') ? args.slice(args.indexOf('--') + 1) : []

// The ports and the build folder can be changed, so that a run does not collide with a development server or another checkout: the
// defaults are not the development servers' 8080 and 5173
const API_PORT = Number(process.env.E2E_API_PORT ?? 18080)
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT ?? 15173)
// One database per API port, so that two runs against the same PostgreSQL do not drop each other's
const databaseName = `botrts_e2e_${API_PORT}`
const databaseUrl = new URL(adminUrl)
databaseUrl.pathname = `/${databaseName}`
const DIST_DIR = '.next-e2e'
const children = []
let hasStarted = false

function run(command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', cwd: root, ...options })

  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed`)
  }
}

function start(name, command, commandArgs, options) {
  const log = createWriteStream(resolve(workDir, `${name}.log`))
  const child = spawn(command, commandArgs, { cwd: root, ...options })

  child.stdout.pipe(log)
  child.stderr.pipe(log)
  children.push(child)

  return child
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(url)).ok) {
        return
      }
    } catch {
      // Not up yet
    }
    await new Promise((done) => setTimeout(done, 1000))
  }
  throw new Error(`${label} did not start (see ${workDir})`)
}

async function resetDatabase() {
  const client = new pg.Client({ connectionString: adminUrl })
  await client.connect()
  await client.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`)
  await client.query(`CREATE DATABASE ${databaseName}`)
  await client.end()
}

// The processes listening on a port (a spec may have restarted the API behind the back of this script)
function listeningOn(port) {
  const found = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })

  return (found.stdout ?? '').split('\n').filter(Boolean).map(Number)
}

// Stops what this run started. The ports were free when it began (checked below), so whatever listens on the API port now is the API
// it started, or one a spec started again after stopping it; a process that was there before is never touched.
function stopAll() {
  for (const child of children) {
    child.kill('SIGTERM')
  }
  if (hasStarted) {
    listeningOn(API_PORT).forEach((pid) => process.kill(pid, 'SIGTERM'))
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(130)
})

let exitCode = 1

try {
  const taken = portsInUse([API_PORT, CLIENT_PORT], listeningOn)
  if (taken.length) {
    throw new Error(
      `Port ${taken.join(' and ')} is in use by another process, which this script will not stop. Choose other ports with E2E_API_PORT and E2E_CLIENT_PORT.`
    )
  }

  hasStarted = true
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(outbox, { recursive: true })

  await resetDatabase()
  run('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(root, 'api'),
    env: { ...process.env, DATABASE_URL: databaseUrl.href }
  })

  const apiUrl = `http://localhost:${API_PORT}`

  // The MCP server the specs play with, built like the API image would have it
  run('npm', ['run', 'build', '-w', 'mcp'])

  if (shouldBuild) {
    run('npm', ['run', 'build', '-w', 'client'], {
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_DIST_DIR: DIST_DIR,
        NEXT_TSCONFIG_PATH: 'tsconfig.typecheck.json'
      }
    })
  }

  // The API trusts X-Forwarded-For so that a test can use an address of its own against the rate limit
  const apiLaunch = {
    command: 'npx',
    args: ['ts-node', 'index.ts'],
    cwd: resolve(root, 'api'),
    log: resolve(workDir, 'api.log'),
    env: {
      NODE_ENV: 'development',
      PORT: String(API_PORT),
      DATABASE_URL: databaseUrl.href,
      FRONTEND_URL: `http://localhost:${CLIENT_PORT}`,
      WHITELIST_URLS: `http://localhost:${CLIENT_PORT}`,
      // The socket origin: without it a developer's api/.env.development would decide, and the page could not connect on another port
      ADMIN_URL: `http://localhost:${CLIENT_PORT}`,
      EMAIL_OUTBOX_DIR: outbox,
      TRUST_PROXY: 'true',
      // The test stack is a test server: the dev tools of the console (and the advance of the game clock) are on
      DEV_TOOLS_ENABLED: 'true',
      // The browser's requests share one address; the rate-limit spec uses addresses of its own
      RATE_LIMIT_AUTH_MAX: '200',
      RATE_LIMIT_API_MAX: '100000',
      // A ban or a logout must show at once in the specs
      AUTH_CACHE_TTL_MS: '0',
      // A spawn seed takes two players, so that a full seed can be shown
      SPAWN_SEED_MAX_PLAYERS: '2',
      // Guessing a bot password takes a tenth of a second and three wrong tries lock the bot out, so that a spec can show it
      BOT_ATTEMPT_DELAY_MS: '100',
      BOT_LOCKOUT_FAILURES: '3',
      WORLD_SEED: '1'
    }
  }
  start('api', apiLaunch.command, apiLaunch.args, { cwd: apiLaunch.cwd, env: { ...process.env, ...apiLaunch.env } })
  start('client', 'npx', ['next', 'start', '--port', String(CLIENT_PORT)], {
    cwd: resolve(root, 'client'),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: apiUrl,
      NEXT_DIST_DIR: DIST_DIR,
      NEXT_TSCONFIG_PATH: 'tsconfig.typecheck.json'
    }
  })

  await waitFor(`${apiUrl}/api/v1/health`, 'The API')
  await waitFor(`http://localhost:${CLIENT_PORT}/`, 'The client')

  const cypress = spawnSync('npx', ['cypress', isOpen ? 'open' : 'run', ...cypressArgs], {
    stdio: 'inherit',
    cwd: resolve(root, 'client'),
    env: {
      ...process.env,
      E2E_OUTBOX_DIR: outbox,
      E2E_DATABASE_URL: databaseUrl.href,
      // How a spec starts the API again after it stopped it
      E2E_API_LAUNCH: JSON.stringify(apiLaunch)
    }
  })

  exitCode = cypress.status ?? 1
} catch (error) {
  console.error(error.message)
} finally {
  stopAll()
}

process.exit(exitCode)
