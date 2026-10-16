import { runWithRequestId } from '../../src/shared/application/request-context'
import { Telemetry } from '../../src/shared/infrastructure/telemetry'

// Run as its own process by the observability integration test: Jest cannot run the OTLP exporters, a plain Node process can.
// Writes one span with one log record inside it to the gateway and prints the trace id.
async function main() {
  const telemetry = new Telemetry({
    serviceName: 'botrts-test-emitter',
    logDirectory: 'logs',
    logFormat: 'json',
    isLogFileEnabled: false,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpHeaders: { authorization: process.env.EMIT_AUTHORIZATION ?? '' },
    traceSampleRatio: 1,
    exportQueueSize: 100
  })
  const message = process.argv[2] ?? 'emitted by the observability test'
  let traceId = ''

  telemetry.tracing.withSpan('emit', { attributes: { 'botrts.kind': 'test' } }, (span) => {
    traceId = span.context?.traceId as string
    runWithRequestId('req-test-1', () => telemetry.logger('emitter').info(message))
    telemetry.tracing.withSpan('child', {}, () => undefined)
  })
  await telemetry.shutdown()
  process.stderr.write(`${traceId}\n`)
}

void main()
