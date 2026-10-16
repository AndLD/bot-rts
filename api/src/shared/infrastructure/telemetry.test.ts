import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { ObservabilityConfig } from '../../config/app-config'
import { Telemetry, TelemetrySettings, telemetrySettings } from './telemetry'

const settings = (overrides: Partial<TelemetrySettings> = {}): TelemetrySettings => ({
  serviceName: 'botrts-test',
  logDirectory: 'logs',
  logFormat: 'json',
  isLogFileEnabled: false,
  otlpEndpoint: undefined,
  otlpHeaders: {},
  traceSampleRatio: 1,
  exportQueueSize: 100,
  ...overrides
})

// The OTLP exporters load Node's HTTP modules with a dynamic import, which Jest's CommonJS runtime refuses; the exporters are
// replaced by ones that keep what they were given. The real export over HTTP is covered by the integration test of 13.2.
const exported = { traces: [] as ReadableSpan[], logs: [] as ReadableLogRecord[], options: [] as unknown[] }

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation((options: unknown) => {
    exported.options.push(options)
    return {
      export: (spans: ReadableSpan[], done: (result: { code: number }) => void) => {
        exported.traces.push(...spans)
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
      export: (logs: ReadableLogRecord[], done: (result: { code: number }) => void) => {
        exported.logs.push(...logs)
        done({ code: 0 })
      },
      shutdown: async () => undefined
    }
  })
}))

describe('Telemetry', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => stdout.mockRestore())

  it('sends the logs and the traces to the gateway with its token, the log with the ids of its span', async () => {
    exported.traces.length = exported.logs.length = exported.options.length = 0
    const telemetry = new Telemetry(
      settings({ otlpEndpoint: 'https://gateway.example:4318/', otlpHeaders: { authorization: 'Bearer secret' } })
    )
    let traceId = ''

    telemetry.tracing.withSpan('work', {}, (span) => {
      traceId = span.context?.traceId as string
      telemetry.logger('app').info('inside the span')
    })
    await telemetry.shutdown()

    expect(exported.options).toEqual([
      { url: 'https://gateway.example:4318/v1/traces', headers: { authorization: 'Bearer secret' } },
      { url: 'https://gateway.example:4318/v1/logs', headers: { authorization: 'Bearer secret' } }
    ])
    expect(exported.traces.map((span) => span.spanContext().traceId)).toEqual([traceId])
    expect(exported.logs.map((log) => [log.body, log.spanContext?.traceId])).toEqual([['inside the span', traceId]])
  })

  it('writes the console and the file, and sends nothing without a gateway', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'botrts-logs-'))
    const telemetry = new Telemetry(settings({ isLogFileEnabled: true, logDirectory: directory }))

    telemetry.logger('app').info('to the console and the file')
    await telemetry.shutdown()

    const [file] = readdirSync(directory)
    expect(JSON.parse(readFileSync(join(directory, file), 'utf8')).message).toBe('to the console and the file')
    expect(JSON.parse(stdout.mock.calls[0][0] as string).message).toBe('to the console and the file')
    rmSync(directory, { recursive: true })
  })

  it('takes its settings from the observability config', () => {
    const observability = {
      logFormat: 'text',
      isLogFileEnabled: true,
      otlpEndpoint: 'http://gateway',
      otlpHeaders: {},
      traceSampleRatio: 0.5,
      exportQueueSize: 10
    } as ObservabilityConfig

    expect(telemetrySettings(observability, 'botrts-api')).toMatchObject({
      serviceName: 'botrts-api',
      logDirectory: 'logs',
      traceSampleRatio: 0.5
    })
    expect(telemetrySettings(observability, 'botrts-api', '/var/log').logDirectory).toBe('/var/log')
  })
})
