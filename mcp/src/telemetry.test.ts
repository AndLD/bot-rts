import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ApiClient } from './api-client'
import { createServer } from './server'
import { createTelemetry, NO_TELEMETRY, OtelTelemetry, readTelemetrySettings, TelemetrySettings } from './telemetry'
import { fakeApi } from './test-support'

// The OTLP exporters load Node's HTTP modules with a dynamic import, which Jest's CommonJS runtime refuses; they are replaced by
// ones that keep what they were given
const exported = { options: [] as unknown[], spans: 0, logs: 0 }
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation((options: unknown) => {
    exported.options.push(options)
    return {
      export: (spans: unknown[], done: (result: { code: number }) => void) => {
        exported.spans += spans.length
        done({ code: 0 })
      },
      shutdown: async () => undefined
    }
  })
}))
jest.mock('@opentelemetry/exporter-logs-otlp-http', () => ({
  OTLPLogExporter: jest.fn().mockImplementation((options: unknown) => {
    exported.options.push(options)
    return {
      export: (logs: unknown[], done: (result: { code: number }) => void) => {
        exported.logs += logs.length
        done({ code: 0 })
      },
      shutdown: async () => undefined
    }
  })
}))

const settings: TelemetrySettings = {
  otlpEndpoint: undefined,
  otlpHeaders: {},
  traceSampleRatio: 1,
  exportQueueSize: 10
}

function traced(overrides: Partial<TelemetrySettings> = {}) {
  const exporter = new InMemorySpanExporter()
  const lines: string[] = []
  const telemetry = new OtelTelemetry(
    { ...settings, ...overrides },
    { spanProcessors: [new SimpleSpanProcessor(exporter)], write: (line) => void lines.push(line) }
  )

  return { telemetry, lines, spans: () => exporter.getFinishedSpans() }
}

describe('readTelemetrySettings', () => {
  it('reads the gateway, its headers, the sampling and the queue from the same variables as the API', () => {
    expect(
      readTelemetrySettings({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://gateway.example',
        OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer t=, x-team = core ,=ignored',
        OTEL_TRACES_SAMPLER_ARG: '0.5',
        OTEL_EXPORT_QUEUE_SIZE: '50'
      })
    ).toEqual({
      otlpEndpoint: 'https://gateway.example',
      otlpHeaders: { authorization: 'Bearer t=', 'x-team': 'core' },
      traceSampleRatio: 0.5,
      exportQueueSize: 50
    })
  })

  it('defaults to no gateway, every trace and a queue of 2048', () => {
    expect(readTelemetrySettings({})).toEqual({
      otlpEndpoint: undefined,
      otlpHeaders: {},
      traceSampleRatio: 1,
      exportQueueSize: 2048
    })
    expect(readTelemetrySettings({ OTEL_TRACES_SAMPLER_ARG: '7', OTEL_EXPORT_QUEUE_SIZE: '-1' })).toMatchObject({
      traceSampleRatio: 1,
      exportQueueSize: 2048
    })
  })
})

describe('OtelTelemetry', () => {
  it('runs a tool call in a span, with the API calls made inside it as its children', async () => {
    const { telemetry, spans } = traced()

    await expect(
      telemetry.tool('bot_scan', async () => {
        const call = telemetry.startApiCall('GET', '/bots')
        call.finish({ status: 200 })
        return 7
      })
    ).resolves.toBe(7)

    const [api, tool] = spans()
    expect(tool.name).toBe('tool bot_scan')
    expect(tool.attributes['mcp.tool.name']).toBe('bot_scan')
    expect(api.name).toBe('GET /bots')
    expect(api.parentSpanContext?.spanId).toBe(tool.spanContext().spanId)
    expect(api.attributes['http.response.status_code']).toBe(200)
  })

  it('hands the API the trace context of the call, and records a failure of the call or of the tool', async () => {
    const { telemetry, spans } = traced()
    const call = telemetry.startApiCall('POST', '/files')

    expect(call.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    call.finish({ failure: 'unreachable' })
    await expect(telemetry.tool('bot_move', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

    const [apiSpan, toolSpan] = spans()
    expect(apiSpan.status).toEqual({ code: 2, message: 'unreachable' })
    expect(toolSpan.status.code).toBe(2)
  })

  it('does not record a call that sampling dropped, but still hands the context on', () => {
    const { telemetry, spans } = traced({ traceSampleRatio: 0 })
    const call = telemetry.startApiCall('GET', '/x')

    call.finish({ status: 200 })

    expect(call.traceparent).toMatch(/-00$/)
    expect(spans()).toHaveLength(0)
  })

  it('logs to the standard error with the trace it was written in', async () => {
    const { telemetry, lines } = traced()

    telemetry.logger.info('outside')
    await telemetry.tool('bot_scan', async () => telemetry.logger.error('inside'))

    expect(lines[0]).toMatch(/^\S+ \[INFO\] outside$/)
    expect(lines[1]).toMatch(/^\S+ \[ERROR\] \[[0-9a-f]{8}\] inside$/)
  })

  it('takes the secrets out of what it logs and out of the failures it records', async () => {
    const { telemetry, lines, spans } = traced()

    telemetry.logger.error('bad key botrts_0123456789abcdef from bob@example.com')
    telemetry.startApiCall('GET', '/me').finish({ failure: 'Bearer abcdef1234567890 refused' })
    await expect(telemetry.tool('t', () => Promise.reject(new Error('password=hunter2')))).rejects.toThrow()

    expect(lines[0]).toContain('bad key [api-key] from [email]')
    expect(spans().map((span) => span.status.message)).toEqual(['Bearer [token] refused', 'Error: password=[redacted]'])
  })

  it('writes to the standard error by default', () => {
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)

    new OtelTelemetry(settings).logger.info('hello')

    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('[INFO] hello\n'))
    stderr.mockRestore()
  })

  it('sends traces and logs to the gateway when there is one, and flushes them on shutdown', async () => {
    exported.options.length = exported.spans = exported.logs = 0
    const telemetry = new OtelTelemetry(
      { ...settings, otlpEndpoint: 'https://gateway.example/', otlpHeaders: { authorization: 'Bearer t' } },
      { write: () => undefined }
    )

    await telemetry.tool('bot_scan', async () => telemetry.logger.info('inside'))
    await telemetry.shutdown()

    expect(exported.options).toEqual([
      { url: 'https://gateway.example/v1/traces', headers: { authorization: 'Bearer t' } },
      { url: 'https://gateway.example/v1/logs', headers: { authorization: 'Bearer t' } }
    ])
    expect([exported.spans, exported.logs]).toEqual([1, 1])
  })

  it('is created from the environment', async () => {
    const telemetry = createTelemetry({})

    await expect(telemetry.shutdown()).resolves.toBeUndefined()
  })
})

describe('NO_TELEMETRY', () => {
  it('does nothing', async () => {
    await expect(NO_TELEMETRY.tool('x', async () => 1)).resolves.toBe(1)
    const call = NO_TELEMETRY.startApiCall('GET', '/x')
    call.finish({ status: 200 })
    NO_TELEMETRY.logger.info('x')
    NO_TELEMETRY.logger.error('x')

    expect(call.traceparent).toBeUndefined()
    await expect(NO_TELEMETRY.shutdown()).resolves.toBeUndefined()
  })
})

describe('the trace from a tool call into the API', () => {
  async function connect(answer?: Parameters<typeof fakeApi>[0]) {
    const api = fakeApi(answer)
    const { telemetry, lines, spans } = traced()
    const server = createServer(new ApiClient('https://g', 'botrts_k', api.fetchImpl, telemetry), undefined, telemetry)
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '1' })
    await Promise.all([server.connect(serverSide), client.connect(clientSide)])

    return { client, api, lines, spans }
  }

  it('sends the API the traceparent of the call, whose trace is the one of the tool call', async () => {
    const { client, api, spans } = await connect()

    await client.callTool({ name: 'list_bots', arguments: {} })

    const traceparent = api.calls[0].headers.traceparent
    const [apiSpan, toolSpan] = spans()
    expect(traceparent).toBe(`00-${apiSpan.spanContext().traceId}-${apiSpan.spanContext().spanId}-01`)
    expect(apiSpan.spanContext().traceId).toBe(toolSpan.spanContext().traceId)
    await client.close()
  })

  it('logs the failure of a tool inside the trace of the call, and marks the API call as failed', async () => {
    const { client, lines, spans } = await connect(() => ({
      status: 403,
      body: { code: 'API_KEY_SCOPE', error: 'No' }
    }))

    await client.callTool({ name: 'list_bots', arguments: {} })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/\[ERROR\] \[[0-9a-f]{8}\] list_bots failed: API_KEY_SCOPE: No/)
    expect(spans()[0].status).toEqual({ code: 2, message: 'HTTP 403' })
    await client.close()
  })

  it('records an API that cannot be reached', async () => {
    const { telemetry, spans } = traced()
    const client = new ApiClient(
      'https://g',
      'botrts_k',
      async () => {
        throw new Error('ECONNREFUSED')
      },
      telemetry
    )

    await expect(client.get('/x')).rejects.toMatchObject({ code: 'UNREACHABLE' })

    expect(spans()[0].status).toEqual({ code: 2, message: 'ECONNREFUSED' })
  })
})
