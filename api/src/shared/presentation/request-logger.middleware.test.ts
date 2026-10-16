import { EventEmitter } from 'events'
import { testTelemetry } from '../../../tests/fakes/telemetry'
import { Logger } from '../application/logger'
import { currentRequestId } from '../application/request-context'
import { NO_TRACING } from '../application/tracing'
import {
  createRequestLogger,
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  TRACE_RESPONSE_HEADER
} from './request-logger.middleware'

const PARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

function exchange(headers: Record<string, string> = {}, route?: string, status = 201) {
  const traced = testTelemetry()
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const observe = jest.fn()
  const response = Object.assign(new EventEmitter(), { statusCode: status, setHeader: jest.fn() })
  const seenInRequest: Array<{ requestId: string | undefined; traceId: string | undefined }> = []
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/bots/b1/scan?token=secret',
    route: route ? { path: route } : undefined,
    header: (name: string) => headers[name]
  }
  const tracing = traced.telemetry.tracing

  createRequestLogger(logger, tracing, observe)(request as never, response as never, () =>
    seenInRequest.push({ requestId: currentRequestId(), traceId: tracing.current()?.traceId })
  )
  response.emit('finish')
  response.emit('close')

  return { logger, observe, response, seenInRequest, traced }
}

describe('createRequestLogger', () => {
  it('starts a trace, returns its id as the request id and in the trace headers, and runs the request inside it', () => {
    const { response, seenInRequest, traced } = exchange()
    const [span] = traced.spans()
    const traceId = span.spanContext().traceId

    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, traceId)
    expect(response.setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, traceId)
    expect(response.setHeader).toHaveBeenCalledWith(
      TRACE_RESPONSE_HEADER,
      `00-${traceId}-${span.spanContext().spanId}-01`
    )
    expect(seenInRequest).toEqual([{ requestId: traceId, traceId }])
    expect(currentRequestId()).toBeUndefined()
  })

  it('continues the trace of the caller', () => {
    const { traced } = exchange({ traceparent: PARENT })
    const [span] = traced.spans()

    expect(span.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    expect(span.parentSpanContext?.spanId).toBe('00f067aa0ba902b7')
  })

  it('keeps an acceptable id of the caller as the request id, and replaces one that is not', () => {
    const kept = exchange({ [REQUEST_ID_HEADER]: 'req-1.a' })

    expect(kept.response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-1.a')
    expect(kept.traced.spans()[0].attributes['botrts.request_id']).toBe('req-1.a')
    const replaced = exchange({ [REQUEST_ID_HEADER]: 'bad id\nwith lines' })

    expect(replaced.response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      replaced.traced.spans()[0].spanContext().traceId
    )
  })

  it('names the span after the route, records the status, and marks a server error as failed', () => {
    const ok = exchange({}, '/api/v1/bots/:botId/scan').traced.spans()[0]
    const failed = exchange({}, undefined, 503).traced.spans()[0]

    expect(ok.name).toBe('POST /api/v1/bots/:botId/scan')
    expect(ok.attributes).toMatchObject({ 'http.request.method': 'POST', 'http.response.status_code': 201 })
    expect(ok.status.code).toBe(0)
    expect(failed.name).toBe('POST unmatched')
    expect(failed.status.code).toBe(2)
  })

  it('logs one line inside the span when the response is finished, without the query string, and reports it', () => {
    const { logger, observe, traced } = exchange({}, '/api/v1/bots/:botId/scan')

    expect(logger.info).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/v1\/bots\/b1\/scan 201 [\d.]+ms$/))
    expect(observe).toHaveBeenCalledWith({
      method: 'POST',
      route: '/api/v1/bots/:botId/scan',
      status: 201,
      durationMs: expect.any(Number),
      traceId: traced.spans()[0].spanContext().traceId
    })
    expect(traced.spans()).toHaveLength(1)
  })

  it('ends the span of a request the client abandoned', () => {
    const traced = testTelemetry()
    const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: jest.fn() })
    const request = { method: 'GET', originalUrl: '/x', header: () => undefined }

    createRequestLogger({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }, traced.telemetry.tracing)(
      request as never,
      response as never,
      jest.fn()
    )
    response.emit('close')

    expect(traced.spans()).toHaveLength(1)
  })

  it('works without tracing and without an observer', () => {
    const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: jest.fn() })
    const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const request = { method: 'GET', originalUrl: '/x', header: () => undefined }

    createRequestLogger(logger, NO_TRACING)(request as never, response as never, jest.fn())

    expect(() => {
      response.emit('finish')
      response.emit('close')
    }).not.toThrow()
    expect(response.setHeader).toHaveBeenCalledTimes(1)
  })
})
