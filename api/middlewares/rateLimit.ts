import { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { apiUtils } from '../utils/api'
import { errors } from '../utils/constants'

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
    handler: (_: Request, res: Response) => apiUtils.sendError(res, errors.TOO_MANY_REQUESTS)
  })
}
