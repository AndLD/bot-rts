import { NextFunction, Request, RequestHandler, Response } from 'express'

// Express 4 does not catch rejected promises; this forwards them to the error handler
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    // `next(null)` would mean "no error", so a rejection without a reason becomes a real error
    handler(req as Req, res, next).catch((error) => next(error ?? new Error('Rejected without a reason')))
  }
}
