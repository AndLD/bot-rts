import { LoggingEvent } from 'log4js'

export type LogFormat = 'json' | 'text'

export interface LogSettings {
  format: LogFormat
  // A file in `logs/` next to the console; containers log to the console only
  isFileEnabled: boolean
}

// `json` by default in production (one JSON object per line, for log collectors), readable text elsewhere
export function readLogSettings(env: Record<string, string | undefined>): LogSettings {
  const format = env.LOG_FORMAT === 'json' || env.LOG_FORMAT === 'text' ? env.LOG_FORMAT : undefined

  return {
    format: format ?? (env.NODE_ENV === 'production' ? 'json' : 'text'),
    isFileEnabled: env.LOG_FILE !== 'false'
  }
}

function describe(data: unknown): string {
  if (data instanceof Error) {
    return data.stack ?? `${data.name}: ${data.message}`
  }
  return typeof data === 'string' ? data : JSON.stringify(data)
}

export function formatEvent(event: LoggingEvent, format: LogFormat, requestId: string | undefined): string {
  const message = event.data.map(describe).join(' ')
  const time = event.startTime.toISOString()

  if (format === 'json') {
    return JSON.stringify({
      time,
      level: event.level.levelStr.toLowerCase(),
      category: event.categoryName,
      requestId,
      message
    })
  }
  return `${time} [${event.level.levelStr}] ${event.categoryName}${requestId ? ` [${requestId}]` : ''} - ${message}`
}
