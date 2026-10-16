import { describe as describeValue, formatRecord, LogRecord } from './log-format'

const record = (overrides: Partial<LogRecord> = {}): LogRecord => ({
  time: new Date('2026-10-14T10:00:00.000Z'),
  level: 'info',
  category: 'app',
  message: 'POST /x 200',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  requestId: 'req-1',
  ...overrides
})

describe('formatRecord', () => {
  it('writes one JSON object with the trace id, the span id and the request id', () => {
    expect(JSON.parse(formatRecord(record(), 'json'))).toEqual({
      time: '2026-10-14T10:00:00.000Z',
      level: 'info',
      category: 'app',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      requestId: 'req-1',
      message: 'POST /x 200'
    })
  })

  it('writes a readable line with a short trace id, and the request id when it is not the trace id', () => {
    expect(formatRecord(record(), 'text')).toBe('2026-10-14T10:00:00.000Z [INFO] app [4bf92f35] [req-1] - POST /x 200')
    expect(formatRecord(record({ requestId: '4bf92f3577b34da6a3ce929d0e0e4736', level: 'warn' }), 'text')).toBe(
      '2026-10-14T10:00:00.000Z [WARN] app [4bf92f35] - POST /x 200'
    )
  })

  it('leaves out what a record outside any trace does not have', () => {
    expect(formatRecord(record({ traceId: undefined, spanId: undefined, requestId: undefined }), 'text')).toBe(
      '2026-10-14T10:00:00.000Z [INFO] app - POST /x 200'
    )
    expect(JSON.parse(formatRecord(record({ traceId: undefined }), 'json')).traceId).toBeUndefined()
  })
})

describe('describe', () => {
  it('uses the stack of an error, strings as they are, and JSON for anything else', () => {
    const failure = new Error('disk full')
    const bare = Object.assign(new Error('no stack'), { stack: undefined })

    expect(describeValue(failure)).toBe(failure.stack)
    expect(describeValue(bare)).toBe('Error: no stack')
    expect(describeValue('text')).toBe('text')
    expect(describeValue({ a: 1 })).toBe('{"a":1}')
  })
})
