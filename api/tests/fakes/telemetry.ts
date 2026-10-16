import { InMemorySpanExporter, ReadableSpan, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { LogFormat, LogRecord } from '../../src/shared/infrastructure/log-format'
import { LogSink } from '../../src/shared/infrastructure/log-sinks'
import { Telemetry } from '../../src/shared/infrastructure/telemetry'

export interface TestTelemetry {
  telemetry: Telemetry
  // Every record that was logged, in order
  records: LogRecord[]
  // The spans that have ended, in the order they ended
  spans(): ReadableSpan[]
}

// The real tracing and logging of the application with the output kept in memory, for tests that check what is traced
export function testTelemetry(sampleRatio = 1, format: LogFormat = 'text'): TestTelemetry {
  const exporter = new InMemorySpanExporter()
  const records: LogRecord[] = []
  const sink: LogSink = { write: (record) => void records.push(record) }
  const telemetry = new Telemetry(
    {
      serviceName: 'test',
      logDirectory: 'logs',
      logFormat: format,
      isLogFileEnabled: false,
      otlpEndpoint: undefined,
      otlpHeaders: {},
      traceSampleRatio: sampleRatio,
      exportQueueSize: 10
    },
    { spanProcessors: [new SimpleSpanProcessor(exporter)], sinks: [sink] }
  )

  return { telemetry, records, spans: () => exporter.getFinishedSpans() }
}
