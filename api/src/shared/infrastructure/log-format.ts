export type LogFormat = 'json' | 'text'

export type LogLevel = 'info' | 'warn' | 'error'

// One line of the log, with the trace it was written in (every record of a request, a tick or a job has one)
export interface LogRecord {
  time: Date
  level: LogLevel
  category: string
  message: string
  traceId: string | undefined
  spanId: string | undefined
  // The id the caller gave the request (X-Request-Id), kept as an alias of the trace id
  requestId: string | undefined
}

export function describe(data: unknown): string {
  if (data instanceof Error) {
    return data.stack ?? `${data.name}: ${data.message}`
  }
  return typeof data === 'string' ? data : JSON.stringify(data)
}

export function formatRecord(record: LogRecord, format: LogFormat): string {
  const time = record.time.toISOString()

  if (format === 'json') {
    return JSON.stringify({
      time,
      level: record.level,
      category: record.category,
      traceId: record.traceId,
      spanId: record.spanId,
      requestId: record.requestId,
      message: record.message
    })
  }
  const trace = record.traceId ? ` [${record.traceId.slice(0, 8)}]` : ''
  const request = record.requestId && record.requestId !== record.traceId ? ` [${record.requestId}]` : ''

  return `${time} [${record.level.toUpperCase()}] ${record.category}${trace}${request} - ${record.message}`
}
