import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

// The gateway collector and Elasticsearch of docker-compose.yml (`npm run obs:up`), with the real OpenTelemetry SDK of a node
// sending to them. CI starts both and sets REQUIRE_OBSERVABILITY, so a missing gateway fails there; on a developer's machine
// without them the tests say so and pass.
const GATEWAY = process.env.OTEL_GATEWAY_URL ?? 'http://localhost:4318'
const HEALTH = process.env.OTEL_GATEWAY_HEALTH_URL ?? 'http://localhost:13133'
const METRICS = process.env.OTEL_GATEWAY_METRICS_URL ?? 'http://localhost:8888/metrics'
const ELASTICSEARCH = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200'
const TOKEN = process.env.OTEL_GATEWAY_TOKEN ?? 'botrts-dev-gateway-token'

let isAvailable = false
let traceId = ''

beforeAll(async () => {
  try {
    isAvailable = (await fetch(HEALTH)).ok && (await fetch(`${ELASTICSEARCH}/_cluster/health`)).ok
  } catch {
    isAvailable = false
  }
  if (!isAvailable && process.env.REQUIRE_OBSERVABILITY) {
    throw new Error('The gateway collector and Elasticsearch are required: run `npm run obs:up`')
  }
  if (isAvailable) {
    traceId = await emit('stored through the gateway')
  }
}, 60000)

// Returns false, loudly, when the gateway is not running on this machine
function available(): boolean {
  if (!isAvailable) {
    console.warn('Skipped: the gateway collector and Elasticsearch are not running (`npm run obs:up`)')
  }
  return isAvailable
}

const search = async (index: string, term: Record<string, string>) => {
  const response = await fetch(`${ELASTICSEARCH}/${index}/_search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: { term }, size: 10 })
  })
  const body = (await response.json()) as { hits?: { hits: Array<{ _source: Record<string, unknown> }> } }

  return body.hits?.hits.map((hit) => hit._source) ?? []
}

async function until<T>(read: () => Promise<T[]>, what: string, timeoutMs = 20000): Promise<T[]> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = await read()
    if (found.length > 0) return found
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

async function emit(message: string): Promise<string> {
  const { stderr } = await run('npx', ['ts-node', '--transpile-only', 'tests/integration/emit-telemetry.ts', message], {
    env: { ...process.env, OTEL_EXPORTER_OTLP_ENDPOINT: GATEWAY, EMIT_AUTHORIZATION: `Bearer ${TOKEN}` }
  })

  return stderr.trim().split('\n').pop() as string
}

describe('the collector gateway and Elasticsearch', () => {
  it('lets only a node with the token send to the gateway', async () => {
    if (!available()) return
    const send = (authorization?: string) =>
      fetch(`${GATEWAY}/v1/logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
        body: '{}'
      })

    expect((await send()).status).toBe(401)
    expect((await send('Bearer wrong')).status).toBe(401)
    expect((await send(`Bearer ${TOKEN}`)).status).toBe(200)
  })

  it('stores the log of a node with its trace id and span id as keywords, and the request id', async () => {
    if (!available()) return
    const [log] = await until(() => search('botrts-logs', { 'trace.id': traceId }), 'the log in Elasticsearch')

    expect(log).toMatchObject({
      message: 'stored through the gateway',
      log: { level: 'INFO', category: 'emitter' },
      service: { name: 'botrts-test-emitter' },
      botrts: { request_id: 'req-test-1' },
      trace: { id: traceId }
    })
    expect((log.span as { id: string }).id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('stores the spans of the same trace, the child under its parent, and finds the log by the span id', async () => {
    if (!available()) return
    const spans = await until(async () => {
      const found = await search('botrts-traces', { TraceId: traceId })
      return found.length === 2 ? found : []
    }, 'the two spans in Elasticsearch')

    const parent = spans.find((span) => span.Name === 'emit')
    const child = spans.find((span) => span.Name === 'child')
    expect(child?.ParentSpanId).toBe(parent?.SpanId)
    expect((await search('botrts-logs', { 'span.id': parent?.SpanId as string }))[0]).toMatchObject({
      trace: { id: traceId }
    })
  })

  it('has the retention policy, the templates and the queue metrics of the gateway', async () => {
    if (!available()) return
    const policy = (await (await fetch(`${ELASTICSEARCH}/_ilm/policy/botrts-retention`)).json()) as {
      'botrts-retention': { policy: { phases: { delete: { min_age: string } } } }
    }
    const streams = (await (await fetch(`${ELASTICSEARCH}/_data_stream/botrts-*`)).json()) as {
      data_streams: Array<{ name: string; ilm_policy: string }>
    }
    const metrics = await (await fetch(METRICS)).text()

    expect(policy['botrts-retention'].policy.phases.delete.min_age).toMatch(/^\d+d$/)
    expect(streams.data_streams.map(({ name, ilm_policy: ilm }) => [name, ilm]).sort()).toEqual([
      ['botrts-logs', 'botrts-retention'],
      ['botrts-traces', 'botrts-retention']
    ])
    expect(metrics).toContain('otelcol_exporter_queue_size')
  })
})
