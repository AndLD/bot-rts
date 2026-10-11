import { rateLimit } from 'express-rate-limit'
import { ErrorCode } from '../../lib/utils/error-codes'
import { AppError } from '../src/shared/domain/app-error'

interface RateLimitOptions {
  windowMs: number
  max: number
}

// In-memory counters per instance; a shared store replaces them in task 8.2
export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, ErrorCode.TOO_MANY_REQUESTS, 'Too many requests, try again later'))
  })
}
