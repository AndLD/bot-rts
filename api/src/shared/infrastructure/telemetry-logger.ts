import { trace } from '@opentelemetry/api'
import { redact } from '../../../../lib/utils/redaction'
import { Logger } from '../application/logger'
import { currentRequestId } from '../application/request-context'
import { describe, LogLevel } from './log-format'
import { LogSink } from './log-sinks'

// The `Logger` port over the sinks of the process. Each record is stamped with the trace id and the span id of the span it is
// written in, and with the secrets taken out of its message.
export class TelemetryLogger implements Logger {
  constructor(
    private readonly category: string,
    private readonly sinks: readonly LogSink[],
    private readonly now: () => Date = () => new Date()
  ) {}

  info(message: string): void {
    this.write('info', message)
  }

  warn(message: string): void {
    this.write('warn', message)
  }

  error(error: unknown): void {
    this.write('error', describe(error))
  }

  private write(level: LogLevel, message: string): void {
    const active = trace.getActiveSpan()?.spanContext()
    const span = active && trace.isSpanContextValid(active) ? active : undefined
    const record = {
      time: this.now(),
      level,
      category: this.category,
      message: redact(message),
      traceId: span?.traceId,
      spanId: span?.spanId,
      requestId: currentRequestId()
    }

    for (const sink of this.sinks) {
      sink.write(record)
    }
  }
}
