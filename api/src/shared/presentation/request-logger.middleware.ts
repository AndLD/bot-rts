import { NextFunction, Request, Response } from 'express'
import { TRACEPARENT_HEADER } from '../../../../lib/utils/trace-context'
import { Logger } from '../application/logger'
import { runWithRequestId } from '../application/request-context'
import { Tracing } from '../application/tracing'

export const REQUEST_ID_HEADER = 'X-Request-Id'
export const TRACE_ID_HEADER = 'X-Trace-Id'
// The response header of the W3C trace context draft: the context of the span that answered
export const TRACE_RESPONSE_HEADER = 'traceresponse'

// A caller may bring its own id (a load balancer, a trace), as long as it is short and harmless to put in a log line
const ACCEPTED_ID = /^[\w.-]{1,64}$/

// What a finished request reports: used for the access log and the metrics
export interface FinishedRequest {
  method: string
  // The route pattern (`/api/v1/bots/:botId`), not the address, so that metrics have a few labels and no ids
  route: string
  status: number
  durationMs: number
}

export type RequestObserver = (request: FinishedRequest) => void

// Starts the span of every request (it continues the trace of the caller's `traceparent`, or starts one), returns the trace id
// in the response, runs the rest of the request inside the span, and logs one line when the response is finished. The request
// id of 8.3 is the trace id unless the caller brought an acceptable X-Request-Id, which is kept as an alias. The query string
// is never logged: it can carry a token.
export function createRequestLogger(logger: Logger, tracing: Tracing, observe: RequestObserver = () => undefined) {
  return function requestLogger(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0]
    const span = tracing.startSpan(`${req.method} ${path}`, {
      kind: 'server',
      parent: req.header(TRACEPARENT_HEADER),
      attributes: { 'http.request.method': req.method, 'url.path': path }
    })
    const supplied = req.header(REQUEST_ID_HEADER)
    const requestId = supplied && ACCEPTED_ID.test(supplied) ? supplied : (span.context?.traceId ?? '')
    const startedAt = process.hrtime.bigint()

    res.setHeader(REQUEST_ID_HEADER, requestId)
    if (span.context && span.traceparent) {
      res.setHeader(TRACE_ID_HEADER, span.context.traceId)
      res.setHeader(TRACE_RESPONSE_HEADER, span.traceparent)
    }
    span.setAttribute('botrts.request_id', requestId)
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const route = (req.route?.path as string | undefined) ?? 'unmatched'
      span.rename(`${req.method} ${route}`)
      span.setAttribute('http.response.status_code', res.statusCode)
      if (res.statusCode >= 500) {
        span.fail(`HTTP ${res.statusCode}`)
      }
      span.run(() =>
        runWithRequestId(requestId, () =>
          logger.info(`${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`)
        )
      )
      observe({ method: req.method, route, status: res.statusCode, durationMs })
    })
    // `close` follows `finish`, and also comes when the client went away before the answer
    res.on('close', () => span.end())

    runWithRequestId(requestId, () => span.run(next))
  }
}
