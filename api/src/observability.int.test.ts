import {
  ELASTICSEARCH,
  emit,
  GATEWAY,
  isObservabilityUp,
  METRICS,
  skipOrFail,
  TOKEN,
  warnSkipped
} from '../tests/integration/gateway'

// The gateway collector and Elasticsearch of docker-compose.yml (`npm run obs:up`), with the real OpenTelemetry SDK of a node sending to
// them.
let isAvailable = false
let traceId = ''

beforeAll(async () => {
  isAvailable = await isObservabilityUp()
  skipOrFail(isAvailable)
  if (isAvailable) {
    traceId = (await emit('stored through the gateway')).traceId
  }
}, 60000)

// Returns false, loudly, when the gateway is not running on this machine
function available(): boolean {
  if (!isAvailable) warnSkipped()
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
