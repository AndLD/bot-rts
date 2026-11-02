import assert from 'node:assert/strict'
import net from 'node:net'
import { test } from 'node:test'
import { decideDatabase, portOf, prepare, realProbes } from './local-gate-database.mjs'

// Stand-ins for the checks: what each port holds, and whether Docker runs
const decide = ({ postgres = 'free', redis = 'free', docker = true } = {}) =>
  decideDatabase({
    postgresPort: 5432,
    redisPort: 6379,
    probes: { postgres: async () => postgres, redis: async () => redis, docker: () => docker }
  })

test('a database that answers on both ports is used, and Docker is not needed', async () => {
  assert.deepEqual(await decide({ postgres: 'answers', redis: 'answers', docker: false }), { action: 'use' })
})

test('Docker not running stops with what to do, whether the ports are free or not', async () => {
  for (const state of [{}, { postgres: 'answers' }, { postgres: 'taken' }]) {
    const result = await decide({ ...state, docker: false })
    assert.equal(result.action, 'stop')
    assert.match(result.message, /Docker is not running/)
    assert.match(result.message, /open -a Docker/)
    assert.match(result.message, /push again/)
  }
})

test('free ports start the containers', async () => {
  assert.deepEqual(await decide(), { action: 'start' })
})

test('a database that answers on one port only starts the missing service (the same project’s containers)', async () => {
  assert.deepEqual(await decide({ postgres: 'answers' }), { action: 'start' })
  assert.deepEqual(await decide({ redis: 'answers' }), { action: 'start' })
})

test('a port taken by a program that does not answer as the database stops with the two lines for .env', async () => {
  const postgres = await decide({ postgres: 'taken' })
  assert.equal(postgres.action, 'stop')
  assert.match(postgres.message, /5432 \(PostgreSQL\)/)
  assert.match(postgres.message, /POSTGRES_PORT=15432/)
  assert.match(postgres.message, /REDIS_PORT=16379/)

  const both = await decide({ postgres: 'answers', redis: 'taken' })
  assert.equal(both.action, 'stop')
  assert.match(both.message, /6379 \(Redis\)/)
  assert.doesNotMatch(both.message, /\(PostgreSQL\)/)
})

test('the ports are the ones the tests will use, not the defaults', async () => {
  const asked = []
  await decideDatabase({
    postgresPort: 15432,
    redisPort: 16379,
    probes: {
      postgres: async (port) => (asked.push(['postgres', port]), 'free'),
      redis: async (port) => (asked.push(['redis', port]), 'free'),
      docker: () => true
    }
  })
  assert.deepEqual(asked, [
    ['postgres', 15432],
    ['redis', 16379]
  ])
})

test('portOf reads the port of a connection string and falls back to the default of the service', () => {
  assert.equal(portOf('postgresql://botrts:botrts@localhost:15432/botrts', 5432), 15432)
  assert.equal(portOf('postgresql://botrts:botrts@localhost/botrts', 5432), 5432)
  assert.equal(portOf('redis://localhost:16379', 6379), 16379)
  assert.equal(portOf('not a url', 6379), 6379)
  assert.equal(portOf(undefined, 6379), 6379)
})

// The real probes against servers of this test: a program that speaks the protocol, one that does not, and a closed port
function listen(onConnection) {
  return new Promise((resolve) => {
    const server = net.createServer(onConnection)
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

test('the real probes tell a database, another program and a free port apart', async () => {
  const postgres = await listen((socket) => socket.on('data', () => socket.end(Buffer.from('N'))))
  const redis = await listen((socket) => socket.on('data', () => socket.end('+PONG\r\n')))
  const other = await listen((socket) => socket.on('data', () => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')))
  const closed = await listen(() => {})
  const closedPort = closed.port
  await new Promise((resolve) => closed.server.close(resolve))

  try {
    assert.equal(await realProbes.postgres(postgres.port), 'answers')
    assert.equal(await realProbes.redis(redis.port), 'answers')
    assert.equal(await realProbes.postgres(other.port), 'taken')
    assert.equal(await realProbes.redis(other.port), 'taken')
    assert.equal(await realProbes.postgres(closedPort), 'free')
    assert.equal(await realProbes.redis(closedPort), 'free')
  } finally {
    for (const { server } of [postgres, redis, other]) {
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
    }
  }
})

// `prepare` is what `harness gate` calls: it gets the ports from the environment of the hook and runs `db:up` only when it must
const stand = (postgres, redis, docker = true) => ({
  postgres: async () => postgres,
  redis: async () => redis,
  docker: () => docker
})
const env = { DATABASE_URL: 'postgresql://x@localhost:15432/x', REDIS_URL: 'redis://localhost:16379' }

test('prepare uses a database that answers and starts nothing', async () => {
  const ran = []
  const result = await prepare({ run: (step) => ran.push(step) && 0, env, probes: stand('answers', 'answers') })
  assert.match(result.message, /a database already answers on the configured ports/)
  assert.deepEqual(ran, [])
})

test('prepare starts the containers when the ports are free, and says what to do when that fails', async () => {
  const ran = []
  await prepare({ run: (step) => ran.push(step.args.join(' ')) && 0, env, probes: stand('free', 'free') })
  assert.deepEqual(ran, ['run db:up'])
  await assert.rejects(
    prepare({ run: () => 1, env, probes: stand('free', 'free') }),
    /"database" failed[\s\S]*POSTGRES_PORT=15432/
  )
})

test('prepare stops the push with the message when Docker is off or a port is taken', async () => {
  await assert.rejects(prepare({ run: () => 0, env, probes: stand('free', 'free', false) }), /open -a Docker/)
  await assert.rejects(prepare({ run: () => 0, env, probes: stand('taken', 'free') }), /15432 \(PostgreSQL\)/)
})
