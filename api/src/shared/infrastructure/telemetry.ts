import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider, LogRecordProcessor } from '@opentelemetry/sdk-logs'
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  ParentBasedSampler,
  SpanProcessor,
  TraceIdRatioBasedSampler
} from '@opentelemetry/sdk-trace-base'
import { ObservabilityConfig } from '../../config/app-config'
import { Logger } from '../application/logger'
import { Tracing } from '../application/tracing'
import { ConsoleLogSink, FileLogSink, LogSink, OtlpLogSink } from './log-sinks'
import { nodeId } from './node-id'
import { OtelTracing } from './otel-tracing'
import { TelemetryLogger } from './telemetry-logger'

export interface TelemetrySettings extends Pick<
  ObservabilityConfig,
  'logFormat' | 'isLogFileEnabled' | 'otlpEndpoint' | 'otlpHeaders' | 'traceSampleRatio' | 'exportQueueSize'
> {
  // Tells the nodes apart in the gateway: `botrts-api` or `botrts-engine`
  serviceName: string
  // Where the log file is written
  logDirectory: string
}

// What a test adds or replaces
export interface TelemetryOverrides {
  spanProcessors?: SpanProcessor[]
  logProcessors?: LogRecordProcessor[]
  // Replaces the console and the file
  sinks?: LogSink[]
}

export const TELEMETRY = Symbol('Telemetry')

let isContextManagerSet = false

// The active span travels through async calls in an AsyncLocalStorage; set once per thread
function enableContextManager(): void {
  if (!isContextManagerSet) {
    isContextManagerSet = true
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
  }
}

const endpoint = (base: string, signal: 'traces' | 'logs') => `${base.replace(/\/+$/, '')}/v1/${signal}`

// The logs and the traces of one thread (the API's, or the engine's): the sinks the log records go to, the tracer and the
// exporters. Without an OTLP endpoint nothing leaves the process except the console and the file.
export class Telemetry {
  readonly tracing: Tracing
  private readonly tracerProvider: BasicTracerProvider
  private readonly loggerProvider: LoggerProvider
  private readonly sinks: LogSink[]
  private readonly file: FileLogSink | undefined

  constructor(settings: TelemetrySettings, overrides: TelemetryOverrides = {}) {
    enableContextManager()
    const resource = resourceFromAttributes({
      'service.name': settings.serviceName,
      'service.instance.id': nodeId()
    })
    const queue = { maxQueueSize: settings.exportQueueSize }
    const headers = settings.otlpHeaders
    const spanProcessors = [...(overrides.spanProcessors ?? [])]
    const logProcessors = [...(overrides.logProcessors ?? [])]

    if (settings.otlpEndpoint) {
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
    this.tracing = new OtelTracing(this.tracerProvider.getTracer(settings.serviceName))

    this.file =
      overrides.sinks || !settings.isLogFileEnabled
        ? undefined
        : new FileLogSink(settings.logFormat, settings.logDirectory, new Date())
    this.sinks = overrides.sinks ?? [new ConsoleLogSink(settings.logFormat), ...(this.file ? [this.file] : [])]
    if (logProcessors.length > 0) {
      this.sinks.push(new OtlpLogSink(this.loggerProvider.getLogger(settings.serviceName)))
    }
  }

  logger(category: string): Logger {
    return new TelemetryLogger(category, this.sinks)
  }

  // Sends what is queued and closes the exporters and the file
  async shutdown(): Promise<void> {
    await Promise.all([this.tracerProvider.shutdown(), this.loggerProvider.shutdown(), this.file?.close()])
  }
}

export function telemetrySettings(
  observability: ObservabilityConfig,
  serviceName: string,
  logDirectory = 'logs'
): TelemetrySettings {
  return { ...observability, serviceName, logDirectory }
}
