import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import type { Tracer } from '@opentelemetry/api'
import { SeverityNumber } from '@opentelemetry/api-logs'
import type { Logger as OtelLogger } from '@opentelemetry/api-logs'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ParentBasedSampler,
  SpanProcessor,
  TraceIdRatioBasedSampler
} from '@opentelemetry/sdk-trace-base'
import { redact } from '../../lib/utils/redaction'
import { formatTraceparent } from '../../lib/utils/trace-context'

// Logs go to the standard error: over stdio the standard output belongs to the protocol
export interface McpLogger {
  info(message: string): void
  error(message: string): void
}

// One call of the game's API; `traceparent` is what the API continues the trace with
export interface ApiCall {
  readonly traceparent: string | undefined
  finish(outcome: { status?: number; failure?: string }): void
}

// The traces and the logs of the MCP server (design §12): a span per tool call, a span per API call under it, whose
// `traceparent` goes to the API in a header, so that a call of an AI client can be followed into the game
export interface Telemetry {
  readonly logger: McpLogger
  // Runs a tool call in a span; the API calls made inside it are its children
  tool<T>(name: string, work: () => Promise<T>): Promise<T>
  startApiCall(method: string, path: string): ApiCall
  shutdown(): Promise<void>
}

export const NO_TELEMETRY: Telemetry = {
  logger: { info: () => undefined, error: () => undefined },
  tool: (_name, work) => work(),
  startApiCall: () => ({ traceparent: undefined, finish: () => undefined }),
  shutdown: () => Promise.resolve()
}

export interface TelemetrySettings {
  otlpEndpoint: string | undefined
  otlpHeaders: Record<string, string>
  traceSampleRatio: number
  exportQueueSize: number
}

type Env = Record<string, string | undefined>

// OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS (`name=value,…`), OTEL_TRACES_SAMPLER_ARG (0 to 1), OTEL_EXPORT_QUEUE_SIZE:
// the same variables as the API's
export function readTelemetrySettings(env: Env): TelemetrySettings {
  const ratio =
    env.OTEL_TRACES_SAMPLER_ARG === undefined || env.OTEL_TRACES_SAMPLER_ARG === ''
      ? NaN
      : Number(env.OTEL_TRACES_SAMPLER_ARG)
  const queue = Number(env.OTEL_EXPORT_QUEUE_SIZE)
  const headers = (env.OTEL_EXPORTER_OTLP_HEADERS ?? '')
    .split(',')
    .map((pair): [string, string] => [
      pair.slice(0, pair.indexOf('=')).trim(),
      pair.slice(pair.indexOf('=') + 1).trim()
    ])
    .filter(([name]) => name !== '')

  return {
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
    otlpHeaders: Object.fromEntries(headers),
    traceSampleRatio: ratio >= 0 && ratio <= 1 ? ratio : 1,
    exportQueueSize: Number.isInteger(queue) && queue > 0 ? queue : 2048
  }
}

let isContextManagerSet = false

const endpoint = (base: string, signal: 'traces' | 'logs') => `${base.replace(/\/+$/, '')}/v1/${signal}`

export class OtelTelemetry implements Telemetry {
  readonly logger: McpLogger
  private readonly tracer: Tracer
  private readonly tracerProvider: BasicTracerProvider
  private readonly loggerProvider: LoggerProvider
  private readonly exported: OtelLogger

  constructor(
    settings: TelemetrySettings,
    // What a test adds: its own span processors, and where the log lines go instead of the standard error
    overrides: { spanProcessors?: SpanProcessor[]; write?: (line: string) => void } = {}
  ) {
    if (!isContextManagerSet) {
      isContextManagerSet = true
      context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
    }
    const resource = resourceFromAttributes({ 'service.name': 'botrts-mcp' })
    const queue = { maxQueueSize: settings.exportQueueSize }
    const spanProcessors = [...(overrides.spanProcessors ?? [])]
    const logProcessors = []

    if (settings.otlpEndpoint) {
      const headers = settings.otlpHeaders
      spanProcessors.push(
        new BatchSpanProcessor(
          new OTLPTraceExporter({ url: endpoint(settings.otlpEndpoint, 'traces'), headers }),
          queue
        )
      )
      logProcessors.push(
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: endpoint(settings.otlpEndpoint, 'logs'), headers }),
          ...queue
        })
      )
    }
    this.tracerProvider = new BasicTracerProvider({
      resource,
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(settings.traceSampleRatio) }),
      spanProcessors
    })
    this.loggerProvider = new LoggerProvider({ resource, processors: logProcessors })
    this.tracer = this.tracerProvider.getTracer('botrts-mcp')
    this.exported = this.loggerProvider.getLogger('botrts-mcp')
    const write = overrides.write ?? ((line: string) => void process.stderr.write(`${line}\n`))
    this.logger = {
      info: (message) => this.log('INFO', SeverityNumber.INFO, message, write),
      error: (message) => this.log('ERROR', SeverityNumber.ERROR, message, write)
    }
  }

  tool<T>(name: string, work: () => Promise<T>): Promise<T> {
    const span = this.tracer.startSpan(`tool ${name}`, { kind: SpanKind.SERVER, attributes: { 'mcp.tool.name': name } })

    return context.with(trace.setSpan(context.active(), span), work).then(
      (value) => {
        span.end()
        return value
      },
      (error: unknown) => {
        span.setStatus({ code: SpanStatusCode.ERROR, message: redact(String(error)) })
        span.end()
        throw error
      }
    )
  }

  startApiCall(method: string, path: string): ApiCall {
    const span = this.tracer.startSpan(`${method} ${path}`, {
      kind: SpanKind.CLIENT,
      attributes: { 'http.request.method': method, 'url.path': path }
    })
    const { traceId, spanId, traceFlags } = span.spanContext()

    return {
      traceparent: formatTraceparent({ traceId, spanId, isSampled: (traceFlags & 1) === 1 }),
      finish: ({ status, failure }) => {
        if (status !== undefined) {
          span.setAttribute('http.response.status_code', status)
        }
        if (failure !== undefined) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: redact(failure) })
        }
        span.end()
      }
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.tracerProvider.shutdown(), this.loggerProvider.shutdown()])
  }

  private log(level: string, severity: SeverityNumber, message: string, write: (line: string) => void): void {
    const active = trace.getActiveSpan()?.spanContext()
    const traceId = active && trace.isSpanContextValid(active) ? active.traceId : undefined

    const clean = redact(message)

    write(`${new Date().toISOString()} [${level}]${traceId ? ` [${traceId.slice(0, 8)}]` : ''} ${clean}`)
    this.exported.emit({ severityNumber: severity, severityText: level, body: clean, context: context.active() })
  }
}

export const createTelemetry = (env: Env): Telemetry => new OtelTelemetry(readTelemetrySettings(env))
