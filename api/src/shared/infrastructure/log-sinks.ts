import { mkdirSync, createWriteStream, WriteStream } from 'fs'
import { join } from 'path'
import { context } from '@opentelemetry/api'
import { SeverityNumber } from '@opentelemetry/api-logs'
import type { Logger as OtelLogger } from '@opentelemetry/api-logs'
import { formatRecord, LogFormat, LogLevel, LogRecord } from './log-format'

// Where a log record goes: the console, a file, OTLP
export interface LogSink {
  write(record: LogRecord): void
}

export class ConsoleLogSink implements LogSink {
  constructor(private readonly format: LogFormat) {}

  write(record: LogRecord): void {
    process.stdout.write(`${formatRecord(record, this.format)}\n`)
  }
}

// A file in `directory`, named after the start of the process; created with the first record
export class FileLogSink implements LogSink {
  private stream: WriteStream | undefined

  constructor(
    private readonly format: LogFormat,
    private readonly directory: string,
    private readonly startedAt: Date
  ) {}

  write(record: LogRecord): void {
    this.stream ??= this.open()
    this.stream.write(`${formatRecord(record, this.format)}\n`)
  }

  close(): Promise<void> {
    const stream = this.stream
    this.stream = undefined

    return stream ? new Promise((resolve) => stream.end(resolve)) : Promise.resolve()
  }

  private open(): WriteStream {
    mkdirSync(this.directory, { recursive: true })

    return createWriteStream(join(this.directory, `${this.startedAt.toISOString().replace(/[:.]/g, '-')}.log`), {
      flags: 'a'
    })
  }
}

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR
}

// Hands the record to the OpenTelemetry Logs SDK inside the active context, which is where the SDK takes the trace id and the
// span id of the record from
export class OtlpLogSink implements LogSink {
  constructor(private readonly logger: OtelLogger) {}

  write(record: LogRecord): void {
    this.logger.emit({
      timestamp: record.time,
      severityNumber: SEVERITY[record.level],
      severityText: record.level.toUpperCase(),
      body: record.message,
      attributes: {
        'log.category': record.category,
        ...(record.requestId ? { 'botrts.request_id': record.requestId } : {})
      },
      context: context.active()
    })
  }
}
