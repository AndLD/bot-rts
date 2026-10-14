import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { Logger } from '../application/logger'
import { runWithRequestId } from '../application/request-context'

export const REQUEST_ID_HEADER = 'X-Request-Id'

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

// Gives every request an id (kept from X-Request-Id when it is acceptable), returns it in the response, runs the rest of the
// request inside it, and logs one line when the response is finished. The query string is never logged: it can carry a token.
export function createRequestLogger(logger: Logger, observe: RequestObserver = () => undefined) {
  return function requestLogger(req: Request, res: Response, next: NextFunction) {
    const supplied = req.header(REQUEST_ID_HEADER)
    const requestId = supplied && ACCEPTED_ID.test(supplied) ? supplied : randomUUID()
    const startedAt = process.hrtime.bigint()

    res.setHeader(REQUEST_ID_HEADER, requestId)
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const route = (req.route?.path as string | undefined) ?? 'unmatched'
      runWithRequestId(requestId, () =>
        logger.info(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${durationMs.toFixed(1)}ms`)
      )
      observe({ method: req.method, route, status: res.statusCode, durationMs })
    })

    runWithRequestId(requestId, next)
  }
}
