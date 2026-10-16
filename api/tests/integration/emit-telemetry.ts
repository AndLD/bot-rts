import { runWithRequestId } from '../../src/shared/application/request-context'
import { Telemetry } from '../../src/shared/infrastructure/telemetry'

// Run as its own process by the observability integration tests: Jest cannot run the OTLP exporters, a plain Node process can.
// It is a node of its own (`EMIT_SERVICE`) that writes one span with a child and one log record to the gateway, continuing the trace
// of `EMIT_TRACEPARENT` when given, and prints `{ traceId, traceparent }` of its span, for the next node to continue.
async function main() {
  const telemetry = new Telemetry({
    serviceName: process.env.EMIT_SERVICE ?? 'botrts-test-emitter',
    logDirectory: 'logs',
    logFormat: 'json',
    isLogFileEnabled: false,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpHeaders: { authorization: process.env.EMIT_AUTHORIZATION ?? '' },
    traceSampleRatio: 1,
    exportQueueSize: 100
  })
  const message = process.argv[2] ?? 'emitted by the observability test'
  let reported = ''

  telemetry.tracing.withSpan(
    'emit',
    { kind: 'server', parent: process.env.EMIT_TRACEPARENT, attributes: { 'botrts.kind': 'test' } },
    (span) => {
      reported = JSON.stringify({ traceId: span.context?.traceId, traceparent: span.traceparent })
      runWithRequestId('req-test-1', () => telemetry.logger('emitter').info(message))
      telemetry.tracing.withSpan('child', {}, () => undefined)
    }
  )
  await telemetry.shutdown()
  process.stderr.write(`${reported}\n`)
}

void main()
