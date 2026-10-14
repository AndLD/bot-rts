import { LoggingEvent } from 'log4js'
import { formatEvent, readLogSettings } from './log-format'

const event = (...data: unknown[]) =>
  ({
    data,
    startTime: new Date('2026-10-14T10:00:00.000Z'),
    categoryName: 'app',
    level: { levelStr: 'INFO' }
  }) as unknown as LoggingEvent

describe('readLogSettings', () => {
  it('logs readable text with a file by default, JSON in production, and lets the environment decide', () => {
    expect(readLogSettings({})).toEqual({ format: 'text', isFileEnabled: true })
    expect(readLogSettings({ NODE_ENV: 'production' })).toEqual({ format: 'json', isFileEnabled: true })
    expect(readLogSettings({ NODE_ENV: 'production', LOG_FORMAT: 'text', LOG_FILE: 'false' })).toEqual({
      format: 'text',
      isFileEnabled: false
    })
    expect(readLogSettings({ LOG_FORMAT: 'json' }).format).toBe('json')
    expect(readLogSettings({ LOG_FORMAT: 'xml' }).format).toBe('text')
  })
})

describe('formatEvent', () => {
  it('writes one JSON object with the request id', () => {
    const line = formatEvent(event('POST /x 200'), 'json', 'req-1')

    expect(JSON.parse(line)).toEqual({
      time: '2026-10-14T10:00:00.000Z',
      level: 'info',
      category: 'app',
      requestId: 'req-1',
      message: 'POST /x 200'
    })
  })

  it('writes readable text, with the request id only when there is one', () => {
    expect(formatEvent(event('hello'), 'text', 'req-1')).toBe('2026-10-14T10:00:00.000Z [INFO] app [req-1] - hello')
    expect(formatEvent(event('hello'), 'text', undefined)).toBe('2026-10-14T10:00:00.000Z [INFO] app - hello')
  })

  it('describes errors by their stack and other values as JSON', () => {
    const error = new Error('boom')

    expect(formatEvent(event(error), 'text', undefined)).toContain('Error: boom')
    expect(formatEvent(event({ a: 1 }, 'x'), 'text', undefined)).toContain('{"a":1} x')
    const stackless = Object.assign(new Error('flat'), { stack: undefined })
    expect(formatEvent(event(stackless), 'text', undefined)).toContain('Error: flat')
  })
})
