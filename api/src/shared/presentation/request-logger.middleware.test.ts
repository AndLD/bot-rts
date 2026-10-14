import { EventEmitter } from 'events'
import { Logger } from '../application/logger'
import { currentRequestId } from '../application/request-context'
import { createRequestLogger, REQUEST_ID_HEADER } from './request-logger.middleware'

function exchange(headers: Record<string, string> = {}, route?: string) {
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const observe = jest.fn()
  const response = Object.assign(new EventEmitter(), { statusCode: 201, setHeader: jest.fn() })
  const seenInRequest: Array<string | undefined> = []
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/bots/b1/scan?token=secret',
    route: route ? { path: route } : undefined,
    header: (name: string) => headers[name]
  }

  createRequestLogger(logger, observe)(request as never, response as never, () =>
    seenInRequest.push(currentRequestId())
  )
  response.emit('finish')

  return { logger, observe, response, seenInRequest }
}

describe('createRequestLogger', () => {
  it('gives the request an id, returns it, and runs the request inside it', () => {
    const { response, seenInRequest } = exchange()
    const id = response.setHeader.mock.calls[0][1]

    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(seenInRequest).toEqual([id])
    expect(currentRequestId()).toBeUndefined()
  })

  it('keeps an acceptable id of the caller and replaces one that is not', () => {
    expect(exchange({ [REQUEST_ID_HEADER]: 'trace-1.a' }).response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'trace-1.a'
    )
    const replaced = exchange({ [REQUEST_ID_HEADER]: 'bad id\nwith lines' }).response.setHeader.mock.calls[0][1]

    expect(replaced).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('logs one line when the response is finished, without the query string, and reports it', () => {
    const { logger, observe } = exchange({}, '/api/v1/bots/:botId/scan')

    expect(logger.info).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/v1\/bots\/b1\/scan 201 [\d.]+ms$/))
    expect(observe).toHaveBeenCalledWith({
      method: 'POST',
      route: '/api/v1/bots/:botId/scan',
      status: 201,
      durationMs: expect.any(Number)
    })
  })

  it('reports a request that matched no route as unmatched', () => {
    expect(exchange().observe).toHaveBeenCalledWith(expect.objectContaining({ route: 'unmatched' }))
  })

  it('works without an observer', () => {
    const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: jest.fn() })
    const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const request = { method: 'GET', originalUrl: '/x', header: () => undefined }

    createRequestLogger(logger)(request as never, response as never, jest.fn())

    expect(() => response.emit('finish')).not.toThrow()
  })
})
