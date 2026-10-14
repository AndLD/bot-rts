import { FakeClock } from '../../../tests/fakes/fakes'
import { LogBuffer } from '../application/log-buffer'
import { runWithRequestId } from '../application/request-context'
import { RecordingLogger } from './recording-logger'

function setup() {
  const inner = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const buffer = new LogBuffer(10)

  return { inner, buffer, logger: new RecordingLogger(inner, buffer, new FakeClock()) }
}

describe('RecordingLogger', () => {
  it('writes through to the real logger and keeps the line, with its level and time', () => {
    const { inner, buffer, logger } = setup()

    logger.info('hello')
    logger.warn('careful')

    expect(inner.info).toHaveBeenCalledWith('hello')
    expect(inner.warn).toHaveBeenCalledWith('careful')
    expect(buffer.search({}, 10).lines).toEqual([
      { at: new FakeClock().now(), level: 'warn', message: 'careful', requestId: null },
      { at: new FakeClock().now(), level: 'info', message: 'hello', requestId: null }
    ])
  })

  it('keeps the id of the request being served', () => {
    const { buffer, logger } = setup()

    runWithRequestId('req-7', () => logger.info('inside'))

    expect(buffer.search({ requestId: 'req-7' }, 10).lines.map((line) => line.message)).toEqual(['inside'])
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
})
