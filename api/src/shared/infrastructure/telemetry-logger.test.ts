import { testTelemetry } from '../../../tests/fakes/telemetry'
import { runWithRequestId } from '../application/request-context'
import { LogRecord } from './log-format'
import { TelemetryLogger } from './telemetry-logger'

describe('TelemetryLogger', () => {
  it('writes the level, the category, the time and the message to every sink', () => {
    const first: LogRecord[] = []
    const second: LogRecord[] = []
    const now = new Date('2026-10-16T10:00:00.000Z')
    const logger = new TelemetryLogger(
      'app',
      [{ write: (record) => void first.push(record) }, { write: (record) => void second.push(record) }],
      () => now
    )

    logger.info('hello')
    logger.warn('careful')
    logger.error(new Error('disk full'))

    expect(first).toEqual(second)
    expect(first.map(({ level, category, time, message }) => ({ level, category, time, message }))).toEqual([
      { level: 'info', category: 'app', time: now, message: 'hello' },
      { level: 'warn', category: 'app', time: now, message: 'careful' },
      { level: 'error', category: 'app', time: now, message: expect.stringContaining('disk full') }
    ])
  })

  it('stamps a record with the ids of the span it is written in, and the id of the request', () => {
    const { telemetry, records } = testTelemetry()
    const logger = telemetry.logger('app')

    logger.info('outside')
    telemetry.tracing.withSpan('work', {}, (span) =>
      runWithRequestId('req-1', () => {
        logger.info('inside')
        expect(records[1]).toMatchObject({
          traceId: span.context?.traceId,
          spanId: span.context?.spanId,
          requestId: 'req-1'
        })
      })
    )

    expect(records[0]).toMatchObject({ traceId: undefined, spanId: undefined, requestId: undefined })
  })

  it('keeps the ids of a span that sampling dropped', () => {
    const { telemetry, records } = testTelemetry(0)

    telemetry.tracing.withSpan('work', {}, () => telemetry.logger('app').info('inside'))

    expect(records[0].traceId).toMatch(/^[0-9a-f]{32}$/)
  })
})
