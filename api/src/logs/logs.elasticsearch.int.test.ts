import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

// The console's log search over the real Elasticsearch of docker-compose.yml (`npm run obs:up`): lines of two nodes are written
// straight into the data stream, and the API reads them back through its read path. Skipped with a warning when Elasticsearch is not
// running, unless REQUIRE_OBSERVABILITY is set (CI).
const ELASTICSEARCH = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200'
// Unique per run, so that the lines of an earlier run in the same Elasticsearch are not found
const RUN = Date.now().toString(16)
const TRACE = `${RUN}${'ab'.repeat(16)}`.slice(0, 32)
const ids = {
  user: `${RUN.padStart(8, '0').slice(-8)}-1111-4111-8111-111111111111`,
  bot: `${RUN.padStart(8, '0').slice(-8)}-2222-4222-8222-222222222222`
}

let isAvailable = false
let database: TestDatabase
let testApp: TestApp
let down: TestApp
let admin: SignedUp

const bearer = () => ({ Authorization: `Bearer ${admin.accessToken}` })
const api = () => request(testApp.url)

async function write(document: Record<string, unknown>) {
  const response = await fetch(`${ELASTICSEARCH}/botrts-logs/_doc?refresh=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(document)
  })
  if (!response.ok) throw new Error(`Elasticsearch refused the line: ${response.status}`)
}

const line = (minutesAgo: number, message: string, extra: Record<string, unknown> = {}) => ({
  '@timestamp': new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  message,
  log: { level: 'INFO', category: 'app' },
  service: { name: 'botrts-api', node: { name: `node-a-${RUN}` } },
  ...extra
})

beforeAll(async () => {
  try {
    isAvailable = (await fetch(`${ELASTICSEARCH}/_cluster/health`)).ok
  } catch {
    isAvailable = false
  }
  if (!isAvailable) {
    if (process.env.REQUIRE_OBSERVABILITY) throw new Error('Elasticsearch is required: run `npm run obs:up`')
    return
  }
  database = await createTestDatabase()
  const env = { LOG_STORE: 'elasticsearch', RATE_LIMIT_API_MAX: '100000' }
  testApp = await startTestApp(database, { ...env, ELASTICSEARCH_URL: ELASTICSEARCH })
  down = await startTestApp(database, { ...env, ELASTICSEARCH_URL: 'http://127.0.0.1:1', LOG_SEARCH_TIMEOUT_MS: '500' })
  admin = await signUpAdmin(testApp, database, 'admin')

  await write(
    line(5, `GET /api/v1/bots 200 ${RUN}`, {
      trace: { id: TRACE },
      span: { id: '1'.repeat(16) },
      botrts: { request_id: TRACE }
    })
  )
  await write(line(4, `player ${ids.user} deployed ${ids.bot} ${RUN}`, { trace: { id: TRACE } }))
  await write(
    line(3, `engine tick failed ${RUN}`, {
      log: { level: 'ERROR', category: 'app' },
      service: { name: 'botrts-engine', node: { name: `node-b-${RUN}` } }
    })
  )
}, 90000)

afterAll(async () => {
  await testApp?.close()
  await down?.close()
  await database?.drop()
})

function available(): boolean {
  if (!isAvailable) console.warn('Skipped: Elasticsearch is not running (`npm run obs:up`)')
  return isAvailable
}

describe('the log search over Elasticsearch', () => {
  it('finds the lines of a trace on every node, newest first, with their node and service', async () => {
    if (!available()) return

    const found = await api().get(`/api/v1/admin/logs?traceId=${TRACE}`).set(bearer()).expect(200)

    expect(found.body).toMatchObject({ store: 'elasticsearch', capacity: null, total: 2 })
    expect(found.body.lines.map((entry: { message: string }) => entry.message)).toEqual([
      `player ${ids.user} deployed ${ids.bot} ${RUN}`,
      `GET /api/v1/bots 200 ${RUN}`
    ])
    expect(found.body.lines[1]).toMatchObject({
      level: 'info',
      traceId: TRACE,
      requestId: TRACE,
      node: `node-a-${RUN}`,
      service: 'botrts-api'
    })
  })

  it('filters by text, level, player, bot and node, and pages', async () => {
    if (!available()) return
    const search = (query: string) => api().get(`/api/v1/admin/logs?${query}`).set(bearer()).expect(200)

    expect((await search(`q=${RUN}&level=error`)).body.lines).toEqual([
      expect.objectContaining({ message: `engine tick failed ${RUN}`, node: `node-b-${RUN}`, service: 'botrts-engine' })
    ])
    expect((await search(`userId=${ids.user}&botId=${ids.bot}`)).body.total).toBe(1)
    expect((await search(`q=${RUN}&node=node-a-${RUN}`)).body.total).toBe(2)
    expect((await search(`q=${RUN}&results=1&offset=2`)).body.lines).toHaveLength(1)
    expect((await search(`q=${RUN}&to=2000-01-01T00:00:00Z&from=1999-12-31T00:00:00Z`)).body.total).toBe(0)
  })

  it('lists the nodes that logged, with their services', async () => {
    if (!available()) return

    const nodes = await api().get('/api/v1/admin/logs/nodes').set(bearer()).expect(200)

    expect(nodes.body).toEqual(
      expect.arrayContaining([
        { id: `node-a-${RUN}`, services: ['botrts-api'] },
        { id: `node-b-${RUN}`, services: ['botrts-engine'] }
      ])
    )
  })

  it('refuses a range wider than the limit, and says plainly when the store is down', async () => {
    if (!available()) return

    const wide = await api()
      .get('/api/v1/admin/logs?from=2026-01-01T00:00:00Z&to=2026-06-01T00:00:00Z')
      .set(bearer())
      .expect(400)
    expect(wide.body.error).toContain('at most 7 days')
    const unavailable = await request(down.url).get('/api/v1/admin/logs').set(bearer()).expect(503)
    expect(unavailable.body).toMatchObject({ code: 'LOG_STORE_UNAVAILABLE' })
    await request(down.url).get('/api/v1/admin/logs/nodes').set(bearer()).expect(503)
  })
})
