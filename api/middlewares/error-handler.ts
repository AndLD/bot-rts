import { NextFunction, Request, Response } from 'express'
import { ErrorCode } from '../../lib/utils/error-codes'
import { AppError } from '../src/shared/domain/app-error'
import { getLogger } from '../utils/logger'

const logger = getLogger('middlewares/error-handler')

// Maps every error to the API error body: { statusCode, code, error }
export function handleError(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ statusCode: err.statusCode, code: err.code, error: err.message })
  }

  const status = (err as { status?: unknown } | null)?.status

  // Malformed JSON and similar client mistakes raised by Express itself
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ statusCode: status, code: ErrorCode.VALIDATION_FAILED, error: 'Invalid request' })
  }

  logger.error(err)
  res.status(500).json({ statusCode: 500, code: ErrorCode.INTERNAL_ERROR, error: 'Internal server error' })
}
