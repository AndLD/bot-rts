import { LogBuffer, LogLine } from './log-buffer'

const line = (n: number, overrides: Partial<LogLine> = {}): LogLine => ({
  at: new Date(n * 1000),
  level: 'info',
  message: `line ${n}`,
  requestId: null,
  ...overrides
})

describe('LogBuffer', () => {
  it('returns the newest lines first, up to the limit, and counts every match', () => {
    const buffer = new LogBuffer(10)
    for (let n = 1; n <= 5; n++) buffer.add(line(n))

    const { lines, total } = buffer.search({}, 3)

    expect(lines.map((found) => found.message)).toEqual(['line 5', 'line 4', 'line 3'])
    expect(total).toBe(5)
  })

  it('forgets the oldest lines once it is full', () => {
    const buffer = new LogBuffer(3)
    for (let n = 1; n <= 7; n++) buffer.add(line(n))

    const { lines, total } = buffer.search({}, 10)

    expect(lines.map((found) => found.message)).toEqual(['line 7', 'line 6', 'line 5'])
    expect(total).toBe(3)
    expect(buffer.capacity).toBe(3)
  })

  it('filters by text (any case), level, request and time', () => {
    const buffer = new LogBuffer(10)
    buffer.add(line(1, { message: 'Player 42 signed in' }))
    buffer.add(line(2, { level: 'warn', message: 'slow query for bot ABC' }))
    buffer.add(line(3, { level: 'error', message: 'boom', requestId: 'req-1' }))
    buffer.add(line(4, { message: 'GET /x 200', requestId: 'req-1' }))

    const messages = (filter: Parameters<LogBuffer['search']>[0]) =>
      buffer.search(filter, 10).lines.map((found) => found.message)

    expect(messages({ text: 'player 42' })).toEqual(['Player 42 signed in'])
    expect(messages({ text: 'bot abc' })).toEqual(['slow query for bot ABC'])
    expect(messages({ level: 'error' })).toEqual(['boom'])
    expect(messages({ requestId: 'req-1' })).toEqual(['GET /x 200', 'boom'])
    expect(messages({ from: new Date(2000), to: new Date(3000) })).toEqual(['boom', 'slow query for bot ABC'])
    expect(messages({ text: 'nothing like this' })).toEqual([])
  })

  it('is empty before anything was logged', () => {
    expect(new LogBuffer(4).search({}, 5)).toEqual({ lines: [], total: 0 })
  })
})
