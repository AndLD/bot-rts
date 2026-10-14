import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_BUCKET_KEY = 'rateLimitBucket'

export type RateLimitBucket = 'api' | 'auth' | 'none'

// Picks the rule of a route or controller; routes without it use the `api` rule
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT_BUCKET_KEY, bucket)
// Liveness checks and the like are never limited
export const SkipRateLimit = () => RateLimit('none')
