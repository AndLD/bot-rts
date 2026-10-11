import { NextFunction, Request, Response } from 'express'
import { isUnexpected, toErrorResponse } from '../src/shared/presentation/error-response'
import { getLogger } from '../utils/logger'

const logger = getLogger('middlewares/error-handler')

// Maps every error to the API error body: { statusCode, code, error }
export function handleError(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isUnexpected(err)) {
    logger.error(err)
  }

  const body = toErrorResponse(err)
  res.status(body.statusCode).json(body)
}
