// Load and soak test against a throwaway stack: a fresh PostgreSQL database and the API (ts-node), with many players who
// each deploy a base and run scripts for a while, while the metrics endpoint is scraped.
//
// Usage: node scripts/load-test.mjs [--players 50] [--scripts 2] [--hogs 0.1] [--duration 60] [--port 18081]
//          [--warmup 10] [--scenario compute|scan|mixed] [--max-p95 80] [--max-wait 20] [--report .load/report.json]
//          [-- ENV=value ...]   (extra settings for the API, e.g. ENGINE_TICK_CAP_RATIO=0.6)
// Needs the PostgreSQL of docker-compose.yml (`npm run db:up`). Exits 1 when a limit (--max-p95 in ms of the 95th percentile
// tick, --max-wait in ticks of the longest unserved wait, no engine overruns above --max-overrun-share) is exceeded.
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { io } from 'socket.io-client'
import pg from 'pg'

const root = resolve(import.meta.dirname, '..')
const workDir = resolve(root, '.load')
const outbox = resolve(workDir, 'outbox')

const rawArgs = process.argv.slice(2)
const split = rawArgs.indexOf('--')
const flags = split >= 0 ? rawArgs.slice(0, split) : rawArgs
const extraEnv = Object.fromEntries(
  (split >= 0 ? rawArgs.slice(split + 1) : []).map((pair) => pair.split(/=(.*)/s).slice(0, 2))
)
const option = (name, fallback) => {
  const index = flags.indexOf(`--${name}`)
  return index >= 0 ? flags[index + 1] : fallback
}

const PLAYERS = Number(option('players', 50))
const SCRIPTS = Number(option('scripts', 2))
const HOG_SHARE = Number(option('hogs', 0.1))
const DURATION_S = Number(option('duration', 60))
// Seconds after the scripts started that are not measured: compiling, loading the map
const WARMUP_S = Number(option('warmup', 10))
const PORT = Number(option('port', 18081))
const SCENARIO = option('scenario', 'mixed')
const MAX_P95_MS = Number(option('max-p95', 80))
const MAX_WAIT_TICKS = Number(option('max-wait', 20))
const MAX_OVERRUN_SHARE = Number(option('max-overrun-share', 0.05))
const REPORT = resolve(root, option('report', '.load/report.json'))
const PASSWORD = 'Pa$$w0rd1'
const METRICS_TOKEN = 'load-test-token'
const PRIVACY_VERSION = /PRIVACY_POLICY_VERSION = '([^']+)'/.exec(
  readFileSync(resolve(root, 'lib/utils/privacy.ts'), 'utf8')
)[1]

const adminUrl = process.env.LOAD_ADMIN_DATABASE_URL ?? 'postgresql://botrts:botrts@localhost:5432/postgres'
const databaseUrl = new URL(adminUrl)
databaseUrl.pathname = '/botrts_load'
const apiUrl = `http://localhost:${PORT}`

const SCRIPTS_BY_KIND = {
  // Arithmetic only: the cost is the interpreter's
  compute:
    'export async function main(bot) { for (let n = 1; ; n++) { let x = 0; for (let i = 0; i < 2000; i++) x += i; bot.log(n); await bot.sleep(1) } }',
  // Calls into the world every cycle: the cost is the engine's commands
  scan: 'export async function main(bot) { for (let n = 1; ; n++) { await bot.scan(); await bot.sleep(200) } }',
  // Never yields: the sandbox must cut it at the slice, and nobody else may suffer
  hog: 'export async function main() { for (;;) {} }'
}

const children = []

// The API is started through `npx`, so killing the child alone leaves the real server running (and a server stuck in a heavy run
// ignores SIGTERM). Each child leads its own process group, which is killed as a whole; the throwaway database needs no graceful stop.
function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // Already gone
    }
  }
}
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143]
]) {
  process.on(signal, () => {
    stopAll()
    process.exit(code)
  })
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text) : null
}

// Runs `work` for every item with at most `limit` at a time
async function pool(items, limit, work) {
  const results = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await work(items[index], index)
      }
    })
  )
  return results
}

const ack = (socket, event, ...args) =>
  new Promise((resolveAck, reject) => {
    socket.timeout(20000).emit(event, ...args, (timeout, result, error) => {
      if (timeout) return reject(timeout)
      if (error) return reject(new Error(`${event}: ${error.msg}`))
      resolveAck(result)
    })
  })

// ---- scrape the metrics endpoint -------------------------------------------------------------------------------------------
async function scrape() {
  const response = await fetch(`${apiUrl}/api/v1/metrics`, { headers: { authorization: `Bearer ${METRICS_TOKEN}` } })
  const values = {}
  for (const line of (await response.text()).split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const match = /^([a-z_0-9]+)(\{[^}]*\})? (\S+)$/.exec(line)
    if (match && !match[2]) values[match[1]] = Number(match[3])
  }
  return values
}

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0
}

// ---- run ---------------------------------------------------------------------------------------------------------------------
let exitCode = 1
try {
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(outbox, { recursive: true })

  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query('DROP DATABASE IF EXISTS botrts_load WITH (FORCE)')
  await admin.query('CREATE DATABASE botrts_load')
  await admin.end()
  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(root, 'api'),
    env: { ...process.env, DATABASE_URL: databaseUrl.href },
    stdio: 'inherit'
  })
  if (migrate.status !== 0) throw new Error('migration failed')

  const log = createWriteStream(resolve(workDir, 'api.log'))
  const server = spawn('npx', ['ts-node', 'index.ts'], {
    detached: true,
    cwd: resolve(root, 'api'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATABASE_URL: databaseUrl.href,
      FRONTEND_URL: 'http://localhost:1',
      WHITELIST_URLS: 'http://localhost:1',
      ADMIN_URL: 'http://localhost:1',
      EMAIL_OUTBOX_DIR: outbox,
      METRICS_TOKEN,
      LOG_FILE: 'false',
      LIFECYCLE_ENABLED: 'false',
      RATE_LIMIT_AUTH_MAX: '100000',
      RATE_LIMIT_API_MAX: '1000000',
      WORLD_SEED: '1',
      ...extraEnv
    }
  })
  server.stdout.pipe(log)
  server.stderr.pipe(log)
  children.push(server)
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${apiUrl}/api/v1/health`)).ok) break
    } catch {
      // Not up yet
    }
    if (attempt > 120) throw new Error(`The API did not start (see ${workDir}/api.log)`)
    await new Promise((done) => setTimeout(done, 1000))
  }

  // Players: register, confirm the email from the outbox, log in, deploy a base
  console.log(`Creating ${PLAYERS} players ...`)
  const emails = Array.from({ length: PLAYERS }, (_, i) => `load-${i}@example.com`)
  await pool(emails, 8, (email) =>
    api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Load', email, password: PASSWORD, acceptedPrivacyVersion: PRIVACY_VERSION }
    })
  )
  await new Promise((done) => setTimeout(done, 1500))
  const tokenByEmail = new Map()
  for (const file of readdirSync(outbox)) {
    const mail = JSON.parse(readFileSync(resolve(outbox, file), 'utf8'))
    const token = /token=([^"&]+)/.exec(mail.html)?.[1]
    if (token && mail.subject === 'Confirm your email') tokenByEmail.set(mail.to, decodeURIComponent(token))
  }
  const players = await pool(emails, 8, async (email, index) => {
    await api('/api/v1/auth/email/verify', { method: 'POST', body: { token: tokenByEmail.get(email) } })
    const { accessToken } = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: PASSWORD } })
    const deployed = await api('/api/v1/bots/base', {
      method: 'POST',
      token: accessToken,
      body: { password: 'secret1' }
    })
    return { index, token: accessToken, baseId: deployed.bot._id }
  })

  // Each player: a socket, a terminal session, a script file and SCRIPTS executions
  console.log('Starting the scripts ...')
  const sockets = []
  let logLines = 0
  let started = 0
  await pool(players, 8, async (player) => {
    const socket = io(apiUrl, { auth: { token: player.token }, transports: ['websocket'], reconnection: false })
    await new Promise((done, fail) => {
      socket.on('connect', done)
      socket.on('connect_error', fail)
    })
    socket.on('script-log', () => void (logLines += 1))
    sockets.push(socket)
    const session = await ack(socket, 'open-terminal', player.baseId)
    await ack(socket, 'terminal-command', session._id, 'cd memory-class1')
    const kinds = []
    for (let n = 0; n < SCRIPTS; n++) {
      const isHog = (player.index * SCRIPTS + n) / (PLAYERS * SCRIPTS) < HOG_SHARE
      kinds.push(isHog ? 'hog' : SCENARIO === 'mixed' ? (n % 2 === 0 ? 'compute' : 'scan') : SCENARIO)
    }
    for (const [n, kind] of kinds.entries()) {
      await ack(socket, 'save-terminal-file', session._id, `job${n}.js`, SCRIPTS_BY_KIND[kind])
      await ack(socket, 'terminal-command', session._id, `run job${n}.js`)
      started += 1
    }
  })
  console.log(`${started} scripts started for ${players.length} players; measuring for ${DURATION_S} s`)

  // Measure
  await new Promise((done) => setTimeout(done, WARMUP_S * 1000))
  const samples = []
  const begin = Date.now()
  const first = await scrape()
  while (Date.now() - begin < DURATION_S * 1000) {
    await new Promise((done) => setTimeout(done, 2000))
    samples.push({ at: Date.now() - begin, ...(await scrape()) })
  }
  const last = samples.at(-1) ?? first

  const ticks = last.botrts_engine_tick - first.botrts_engine_tick
  const overrun = last.botrts_engine_overrun_ticks_total - first.botrts_engine_overrun_ticks_total
  const cut = last.botrts_engine_cut_ticks_total - first.botrts_engine_cut_ticks_total
  const p95 = samples.map((s) => s.botrts_engine_tick_p95_milliseconds).sort((a, b) => a - b)
  const waits = samples.map((s) => s.botrts_engine_max_wait_ticks)
  const rss = samples.map((s) => s.botrts_process_resident_memory_bytes)
  const report = {
    players: PLAYERS,
    scriptsPerPlayer: SCRIPTS,
    hogShare: HOG_SHARE,
    scenario: SCENARIO,
    settings: extraEnv,
    durationS: DURATION_S,
    executions: last.botrts_engine_executions,
    ticksPerSecond: +(ticks / DURATION_S).toFixed(2),
    tickP95Ms: { median: percentile(p95, 0.5), worst: p95.at(-1) ?? 0 },
    overrunShare: ticks ? +(overrun / ticks).toFixed(4) : 0,
    cutShare: ticks ? +(cut / ticks).toFixed(4) : 0,
    maxWaitTicks: Math.max(0, ...waits),
    queuedExecutions: last.botrts_engine_queued_executions,
    sandboxMemoryMb: +(last.botrts_engine_sandbox_memory_bytes / 1048576).toFixed(1),
    rssMb: { start: +((rss[0] ?? 0) / 1048576).toFixed(0), end: +((rss.at(-1) ?? 0) / 1048576).toFixed(0) },
    scriptLogLinesReceived: logLines
  }
  writeFileSync(REPORT, JSON.stringify({ report, samples }, null, 2))
  console.log(JSON.stringify(report, null, 2))

  const problems = []
  if (report.tickP95Ms.worst > MAX_P95_MS) problems.push(`tick p95 ${report.tickP95Ms.worst} ms > ${MAX_P95_MS} ms`)
  if (report.maxWaitTicks > MAX_WAIT_TICKS)
    problems.push(`an execution went ${report.maxWaitTicks} ticks unserved > ${MAX_WAIT_TICKS}`)
  if (report.overrunShare > MAX_OVERRUN_SHARE) problems.push(`${report.overrunShare * 100}% of the ticks overran`)
  if (report.executions < started * 0.9) problems.push(`only ${report.executions} of ${started} executions are alive`)
  problems.forEach((problem) => console.error(`LIMIT EXCEEDED: ${problem}`))
  exitCode = problems.length ? 1 : 0
  sockets.forEach((socket) => socket.close())
} catch (error) {
  console.error(error.message)
} finally {
  stopAll()
}

process.exit(exitCode)
