import { TooManyRequestsError } from '../../shared/domain/errors'

export const RATE_LIMIT_STORE = Symbol('RateLimitStore')
export const RATE_LIMITER = Symbol('RateLimiter')

// How many requests a subject may make in a fixed window
export interface RateLimitRule {
  limit: number
  windowMs: number
}

export interface RateLimitHit {
  hits: number
  // Milliseconds until the window of this subject ends
  resetInMs: number
}

// Counts requests per key in a fixed window (memory on one node, Redis across nodes)
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>
}

export interface RateLimitDecision {
  limit: number
  remaining: number
  resetInSeconds: number
}

// Fixed-window rate limiting by bucket (a named rule such as `auth` or `api`) and subject (a client address or an API key)
export class RateLimiter {
  // `activity` is told of every request refused, for the console's rate-limit hits
  constructor(
    private readonly store: RateLimitStore,
    private readonly activity?: { rateLimitHit(): void }
  ) {}

  // Counts the request and returns what is left; throws TooManyRequestsError once the rule is used up
  async consume(bucket: string, subject: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const { hits, resetInMs } = await this.store.hit(`${bucket}:${subject}`, rule.windowMs)
    const resetInSeconds = Math.max(1, Math.ceil(resetInMs / 1000))

    if (hits > rule.limit) {
      this.activity?.rateLimitHit()
      throw new TooManyRequestsError(resetInSeconds)
    }

    return { limit: rule.limit, remaining: rule.limit - hits, resetInSeconds }
  }
}
