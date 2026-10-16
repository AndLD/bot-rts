import { createServer, Server } from 'http'
import { AddressInfo } from 'net'
import request from 'supertest'
import { signUpVerified, startTestApp, TestApp } from '../tests/integration/test-app'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { testTelemetry, TestTelemetry } from '../tests/fakes/telemetry'
import { TELEMETRY } from './shared/infrastructure/telemetry'

// One request followed over the API and the engine thread (design §12): the engine thread has its own telemetry and sends its
// spans to a gateway, here a server of the test; the API thread keeps its spans in memory.

interface OtlpSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
}

let database: TestDatabase
let testApp: TestApp
let api: TestTelemetry
let gateway: Server
let engineSpans: OtlpSpan[]

beforeAll(async () => {
  // The engine thread exports often enough for a test to wait for it
  process.env.OTEL_BSP_SCHEDULE_DELAY = '100'
  engineSpans = []
  gateway = createServer((incoming, response) => {
    const chunks: Buffer[] = []
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
    incoming.on('end', () => {
      if (incoming.url === '/v1/traces') {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as {
          resourceSpans: Array<{ scopeSpans: Array<{ spans: OtlpSpan[] }> }>
        }
        engineSpans.push(
          ...body.resourceSpans.flatMap((resource) => resource.scopeSpans.flatMap((scope) => scope.spans))
        )
      }
      response.setHeader('content-type', 'application/json').end('{}')
    })
  })
  await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve))
  api = testTelemetry()
  database = await createTestDatabase()
  testApp = await startTestApp(
    database,
    {
      ENGINE_ENABLED: 'true',
      ENGINE_TICK_INTERVAL_MS: '20',
      MONITORING_ENABLED: 'true',
      MONITORING_INTERVAL_MS: '200',
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`
    },
    [{ provide: TELEMETRY, useValue: api.telemetry }]
  )
}, 90000)

afterAll(async () => {
  await testApp.close()
  await database.drop()
  gateway.close()
  delete process.env.OTEL_BSP_SCHEDULE_DELAY
})

async function until(condition: () => boolean, what: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const CALLER_TRACE = '4bf92f3577b34da6a3ce929d0e0e4736'
const CALLER_SPAN = '00f067aa0ba902b7'

describe('a request followed over the API and the engine thread', () => {
  it('continues the trace of the caller into the engine thread', async () => {
    const player = await signUpVerified(testApp, database, 'tracer@example.com')
    const bearer = { Authorization: `Bearer ${player.accessToken}` }
    const deployed = await request(testApp.url)
      .post('/api/v1/bots/base')
      .set(bearer)
      .send({ password: 'secret1' })
      .expect(201)
    const botId = deployed.body.bot._id as string

    const response = await request(testApp.url)
      .post(`/api/v1/bots/${botId}/scan`)
      .set(bearer)
      .set('traceparent', `00-${CALLER_TRACE}-${CALLER_SPAN}-01`)
      .expect(200)

    expect(response.headers['x-trace-id']).toBe(CALLER_TRACE)
    expect(response.headers['x-request-id']).toBe(CALLER_TRACE)
    const inApi = api.spans().filter((span) => span.spanContext().traceId === CALLER_TRACE)
    const http = inApi.find((span) => span.name === 'POST /api/v1/bots/:id/scan')
    expect(http?.parentSpanContext?.spanId).toBe(CALLER_SPAN)
    const call = inApi.find((span) => span.name === 'engine act' && span.kind === 2)
    expect(call?.parentSpanContext?.spanId).toBe(http?.spanContext().spanId)

    await until(() => engineSpans.some((span) => span.traceId === CALLER_TRACE), 'the engine spans of the request')
    const inEngine = engineSpans.filter((span) => span.traceId === CALLER_TRACE)
    const received = inEngine.find((span) => span.name === 'engine act')
    expect(received?.parentSpanId).toBe(call?.spanContext().spanId)
    const applied = inEngine.find((span) => span.name === 'engine.act scan.scan')
    expect(applied?.parentSpanId).toBe(received?.spanId)
  })

  it('has a trace of its own for every tick of the engine', async () => {
    await until(() => engineSpans.filter((span) => span.name === 'engine.tick').length >= 3, 'three ticks')

    const ticks = engineSpans.filter((span) => span.name === 'engine.tick')
    expect(ticks.every((span) => !span.parentSpanId)).toBe(true)
    expect(new Set(ticks.map((span) => span.traceId)).size).toBe(ticks.length)
  })

  it('writes every record of a request and of a job inside a span', async () => {
    await request(testApp.url).get('/api/v1/health').expect(200)
    await request(testApp.url).get('/api/v1/nope').expect(404)
    await until(() => api.spans().some((span) => span.name === 'job monitoring-sample'), 'a monitoring sample')

    expect(api.records.length).toBeGreaterThan(0)
    expect(api.records.filter((record) => record.traceId === undefined)).toEqual([])
  })
})
