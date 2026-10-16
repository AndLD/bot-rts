import { testTelemetry } from '../../../tests/fakes/telemetry'
import { FakeClock } from '../../../tests/fakes/fakes'
import { LogBuffer } from '../application/log-buffer'
import { runWithRequestId } from '../application/request-context'
import { RecordingLogger } from './recording-logger'

function setup() {
  const traced = testTelemetry()
  const inner = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const buffer = new LogBuffer(10)

  return {
    inner,
    buffer,
    traced,
    logger: new RecordingLogger(inner, buffer, new FakeClock(), traced.telemetry.tracing)
  }
}

describe('RecordingLogger', () => {
  it('writes through to the real logger and keeps the line, with its level and time', () => {
    const { inner, buffer, logger } = setup()

    logger.info('hello')
    logger.warn('careful')

    expect(inner.info).toHaveBeenCalledWith('hello')
    expect(inner.warn).toHaveBeenCalledWith('careful')
    expect(buffer.search({}, 10).lines).toEqual([
      { at: new FakeClock().now(), level: 'warn', message: 'careful', requestId: null, traceId: null },
      { at: new FakeClock().now(), level: 'info', message: 'hello', requestId: null, traceId: null }
    ])
  })

  it('keeps the id of the request being served', () => {
    const { buffer, logger } = setup()

    runWithRequestId('req-7', () => logger.info('inside'))

    expect(buffer.search({ requestId: 'req-7' }, 10).lines.map((line) => line.message)).toEqual(['inside'])
  })

  it('keeps the trace the line was written in', () => {
    const { buffer, logger, traced } = setup()

    const traceId = traced.telemetry.tracing.withSpan('work', {}, (span) => {
      logger.info('inside')
      return span.context?.traceId
    })

    expect(buffer.search({ traceId }, 10).lines.map((line) => line.message)).toEqual(['inside'])
  })

  it('describes errors, strings and other values', () => {
    const { inner, buffer, logger } = setup()
    const failure = new Error('disk full')

    logger.error(failure)
    logger.error('plain text')
    logger.error({ code: 7 })
    logger.error(Object.assign(new Error('no stack'), { stack: undefined }))

    const messages = buffer.search({}, 10).lines.map((line) => line.message)
    expect(inner.error).toHaveBeenCalledWith(failure)
    expect(messages[3]).toContain('disk full')
    expect(messages.slice(0, 3)).toEqual(['Error: no stack', '{"code":7}', 'plain text'])
  })

  it('keeps the line without its secrets', () => {
    const { buffer, logger } = setup()

    logger.warn('reset link ?token=abc123 sent to bob@example.com')

    expect(buffer.search({}, 10).lines[0].message).toBe('reset link ?token=[redacted] sent to [email]')
  })
})
