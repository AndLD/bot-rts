import { ELASTICSEARCH, GATEWAY, isObservabilityUp, skipOrFail, TOKEN, warnSkipped } from '../tests/integration/gateway'

// The second line of defence of the privacy rule (Phase 13.5): a node that sends secrets in the clear, as an old or a third-party one
// might, has them taken out by the gateway before they reach Elasticsearch. Raw OTLP is posted, so the SDK's own redaction is not involved.
const RUN = Date.now().toString(16)
const TRACE = `${RUN}${'cd'.repeat(16)}`.slice(0, 32)
const SPAN = `${RUN}${'ef'.repeat(8)}`.slice(0, 16)

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const SECRETS = ['alice@example.com', 'hunter2', 'botrts_0123456789abcdef', 'abcdef1234567890xyz', JWT]
const DIRTY = `login of alice@example.com with password=hunter2, key botrts_0123456789abcdef, Bearer abcdef1234567890xyz, token ${JWT}`

let isAvailable = false

beforeAll(async () => {
  isAvailable = await isObservabilityUp()
  skipOrFail(isAvailable)
})

const now = () => `${Date.now()}000000`
const text = (value: string) => ({ stringValue: value })
const resource = { attributes: [{ key: 'service.name', value: text('botrts-redaction-test') }] }

async function post(path: string, body: unknown) {
  const response = await fetch(`${GATEWAY}/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body)
  })
  expect(response.status).toBe(200)
}

async function find(index: string, field: string, value: string): Promise<Record<string, unknown> | undefined> {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const response = await fetch(`${ELASTICSEARCH}/${index}/_search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: { term: { [field]: value } }, size: 1 })
    })
    const body = (await response.json()) as { hits?: { hits: Array<{ _source: Record<string, unknown> }> } }
    if (body.hits?.hits.length) return body.hits.hits[0]._source
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return undefined
}

describe('the gateway redaction', () => {
  it('takes the secrets out of the body and the attributes of a log record', async () => {
    if (!isAvailable) return warnSkipped()
    await post('logs', {
      resourceLogs: [
        {
          resource,
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: now(),
                  severityNumber: 9,
                  traceId: TRACE,
                  body: text(DIRTY),
                  attributes: [{ key: 'botrts.note', value: text('contact bob@example.com, password=hunter2') }]
                }
              ]
            }
          ]
        }
      ]
    })

    const stored = await find('botrts-logs', 'trace.id', TRACE)

    expect(stored).toBeDefined()
    const written = JSON.stringify(stored)
    for (const secret of SECRETS) expect(written).not.toContain(secret)
    expect(written).not.toContain('bob@example.com')
    expect(stored?.message).toBe(
      'login of [email] with password=[redacted], key [api-key], Bearer [token], token [token]'
    )
  })

  it('takes the secrets out of the name, the status and the attributes of a span, and of its events', async () => {
    if (!isAvailable) return warnSkipped()
    await post('traces', {
      resourceSpans: [
        {
          resource,
          scopeSpans: [
            {
              spans: [
                {
                  traceId: TRACE,
                  spanId: SPAN,
                  name: 'GET /users/alice@example.com',
                  kind: 2,
                  startTimeUnixNano: now(),
                  endTimeUnixNano: now(),
                  attributes: [{ key: 'http.header', value: text('Bearer abcdef1234567890xyz') }],
                  status: { code: 2, message: DIRTY },
                  events: [
                    {
                      name: 'exception',
                      timeUnixNano: now(),
                      attributes: [{ key: 'exception.message', value: text('password=hunter2') }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    const stored = await find('botrts-traces', 'SpanId', SPAN)

    expect(stored).toBeDefined()
    const written = JSON.stringify(stored)
    for (const secret of SECRETS) expect(written).not.toContain(secret)
    expect(stored?.Name).toBe('GET /users/[email]')
  })
})
