import { Clock } from '../application/clock'
import { LogBuffer, LogLevel } from '../application/log-buffer'
import { Logger } from '../application/logger'
import { currentRequestId } from '../application/request-context'

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`
  }

  return typeof error === 'string' ? error : JSON.stringify(error)
}

// Writes through to the real logger and keeps each line in the buffer the console searches
export class RecordingLogger implements Logger {
  constructor(
    private readonly inner: Logger,
    private readonly buffer: LogBuffer,
    private readonly clock: Clock
  ) {}

  info(message: string): void {
    this.inner.info(message)
    this.record('info', message)
  }

  warn(message: string): void {
    this.inner.warn(message)
    this.record('warn', message)
  }

  error(error: unknown): void {
    this.inner.error(error)
    this.record('error', describe(error))
  }

  private record(level: LogLevel, message: string): void {
    this.buffer.add({ at: this.clock.now(), level, message, requestId: currentRequestId() ?? null })
  }
}
