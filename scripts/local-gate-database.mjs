// The database setup of the local gate (scripts/local-gate.mjs, run by .githooks/pre-push): before `npm run db:up`, find out which case the push is in
// and act on it, so that a failure says what to do and nobody reaches for `git push --no-verify` (docs/testing/README.md, "Local database").
import { spawnSync } from 'node:child_process'
import net from 'node:net'

const PROBE_TIMEOUT_MS = 2000
const DOCKER_TIMEOUT_MS = 15000
// The first bytes a PostgreSQL server answers to an SSLRequest ('S' or 'N') and a Redis server to PING ('+PONG', or an error line such as -NOAUTH)
const POSTGRES_SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])
const REDIS_PING = Buffer.from('PING\r\n')
const isPostgresReply = (reply) => reply[0] === 0x53 || reply[0] === 0x4e
const isRedisReply = (reply) => reply[0] === 0x2b || reply[0] === 0x2d

/**
 * What listens on a local port: `answers` when it speaks the protocol, `free` when nothing accepts a connection, `taken` when something accepts
 * one and does not answer as the service (another program, or a container that is not ready).
 */
function probePort(port, request, isReply) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (state) => {
      if (!settled) {
        settled = true
        socket.destroy()
        resolve(state)
      }
    }

    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish('taken'))
    socket.on('connect', () => socket.write(request))
    socket.on('data', (reply) => finish(isReply(reply) ? 'answers' : 'taken'))
    socket.on('error', (error) => finish(error.code === 'ECONNREFUSED' ? 'free' : 'taken'))
    socket.on('close', () => finish('taken'))
  })
}

/** The real checks; the decision below takes them as parameters so that a test can stand in for them. */
export const realProbes = {
  postgres: (port) => probePort(port, POSTGRES_SSL_REQUEST, isPostgresReply),
  redis: (port) => probePort(port, REDIS_PING, isRedisReply),
  docker: () => {
    const result = spawnSync('docker', ['info'], { stdio: 'ignore', timeout: DOCKER_TIMEOUT_MS })

    return result.status === 0
  }
}

/** The port of a connection string, or the service's default when the string has none or is not a URL */
export function portOf(url, fallback) {
  try {
    const port = Number(new URL(url).port)

    return Number.isInteger(port) && port > 0 ? port : fallback
  } catch {
    return fallback
  }
}

const ENV_LINES = ['POSTGRES_PORT=15432', 'REDIS_PORT=16379']

/**
 * The case the gate is in before it needs the database.
 * @param {{ postgresPort: number, redisPort: number, probes: typeof realProbes }} options the ports the tests will use, and the checks
 * @returns {Promise<{ action: 'use' | 'start' | 'stop', message?: string }>}
 *   `use`: a database already answers on both ports, run the tests against it; `start`: run `npm run db:up`; `stop`: print `message` and fail
 */
export async function decideDatabase({ postgresPort, redisPort, probes }) {
  const [postgres, redis] = await Promise.all([probes.postgres(postgresPort), probes.redis(redisPort)])

  if (postgres === 'answers' && redis === 'answers') {
    return { action: 'use' }
  }
  if (!(await probes.docker())) {
    return {
      action: 'stop',
      message:
        'pre-push: the tests of api need PostgreSQL and Redis, and Docker is not running. Start Docker Desktop (`open -a Docker`), then push again.'
    }
  }

  const taken = [
    ...(postgres === 'taken' ? [`${postgresPort} (PostgreSQL)`] : []),
    ...(redis === 'taken' ? [`${redisPort} (Redis)`] : [])
  ]

  if (taken.length) {
    return {
      action: 'stop',
      message: [
        `pre-push: port ${taken.join(' and ')} is in use by a program that is not the database of this checkout (often another checkout's containers).`,
        'Give this checkout its own ports: put these two lines in `.env` at its root (copy .env.example; choose other ports if these are taken), then push again:',
        ...ENV_LINES.map((line) => `  ${line}`)
      ].join('\n')
    }
  }

  return { action: 'start' }
}

/** What to print when `npm run db:up` failed although the ports looked free */
export const DB_UP_FAILED_MESSAGE = [
  'pre-push: `npm run db:up` failed. If the message above names a port that is already allocated, another checkout holds it: put these two lines',
  'in `.env` at the root of this checkout, then push again:',
  ...ENV_LINES.map((line) => `  ${line}`)
].join('\n')
