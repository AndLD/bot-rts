import { rateLimit } from '../utils/constants'
import { createRateLimiter } from './rateLimit'

// Shared by signup, login and refresh
export const authRateLimiter = createRateLimiter({ windowMs: rateLimit.windowMs, max: rateLimit.maxAuthRequests })
