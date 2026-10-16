import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { ELASTICSEARCH, emit, isObservabilityUp, skipOrFail, warnSkipped } from '../../tests/integration/gateway'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

// A request followed over two nodes in the real store: an API node and an engine node, each a process with the real OpenTelemetry SDK,
// send through the gateway to Elasticsearch; the console reads the trace back. Skipped with a warning when they are not running.
let isAvailable = false
let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let traceId = ''
let apiSpan = ''

const bearer = () => ({ Authorization: `Bearer ${admin.accessToken}` })

async function until(condition: () => Promise<boolean>, what: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

beforeAll(async () => {
  isAvailable = await isObservabilityUp()
  skipOrFail(isAvailable)
  if (!isAvailable) return
  database = await createTestDatabase()
  testApp = await startTestApp(database, {
    LOG_STORE: 'elasticsearch',
    ELASTICSEARCH_URL: ELASTICSEARCH,
    RATE_LIMIT_API_MAX: '100000'
  })
  admin = await signUpAdmin(testApp, database, 'admin')

  const api = await emit('the API node handled the request', { service: 'botrts-api' })
  traceId = api.traceId
  apiSpan = api.traceparent.split('-')[2]
  await emit('the engine node applied it', { service: 'botrts-engine', traceparent: api.traceparent })
}, 90000)

afterAll(async () => {
  await testApp?.close()
  await database?.drop()
})

describe('a trace over two nodes, read from the store', () => {
  it('shows the spans of both nodes, the engine continuing the API, and every line in order', async () => {
    if (!isAvailable) return warnSkipped()
    let view: { spans: Array<Record<string, unknown>>; logs: Array<Record<string, unknown>> } = { spans: [], logs: [] }
    await until(async () => {
      view = (await request(testApp.url).get(`/api/v1/admin/traces/${traceId}`).set(bearer())).body
      return view.spans?.length === 4 && view.logs?.length === 2
    }, 'both nodes in the store')

    const emits = view.spans.filter((span) => span.name === 'emit')
    const engine = emits.find((span) => span.service === 'botrts-engine')
    const apiNode = emits.find((span) => span.service === 'botrts-api')
    expect(engine).toMatchObject({ parentSpanId: apiSpan, kind: 'server', status: 'unset' })
    expect(apiNode?.spanId).toBe(apiSpan)
    expect(view.spans.filter((span) => span.name === 'child').map((span) => span.parentSpanId)).toEqual(
      expect.arrayContaining([apiNode?.spanId, engine?.spanId])
    )
    expect(view.logs.map((line) => line.message)).toEqual([
      'the API node handled the request',
      'the engine node applied it'
    ])
    expect(view.logs.map((line) => line.service)).toEqual(['botrts-api', 'botrts-engine'])
    expect(view.logs.every((line) => line.traceId === traceId)).toBe(true)
  })

  it('finds the same trace by the request id of its lines, and says 404 for a trace that is not there', async () => {
    if (!isAvailable) return warnSkipped()

    const byRequest = await request(testApp.url).get('/api/v1/admin/traces/req-test-1').set(bearer())

    expect(byRequest.status).toBe(200)
    await request(testApp.url)
      .get(`/api/v1/admin/traces/${'d'.repeat(32)}`)
      .set(bearer())
      .expect(404)
  })
})
