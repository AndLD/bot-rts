import Redis from 'ioredis'
import { Logger } from '../../shared/application/logger'
import { RateLimitHit, RateLimitStore } from '../application/rate-limiter'

// Counters shared by every API node. A Redis failure must not take the API down or switch limiting off: the request is
// counted by the fallback store of this node instead.
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: Redis,
    private readonly fallback: RateLimitStore,
    private readonly logger: Logger
  ) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    try {
      const results = await this.redis
        .multi()
        .set(`botrts:rl:${key}`, 0, 'PX', windowMs, 'NX')
        .incr(`botrts:rl:${key}`)
        .pttl(`botrts:rl:${key}`)
        .exec()
      const [, [, hits], [, ttl]] = results as [unknown, [unknown, number], [unknown, number]]

      return { hits, resetInMs: ttl > 0 ? ttl : windowMs }
    } catch (error) {
      this.logger.warn(`Rate limit store unavailable, counting on this node: ${(error as Error).message}`)
      return this.fallback.hit(key, windowMs)
    }
  }
}
