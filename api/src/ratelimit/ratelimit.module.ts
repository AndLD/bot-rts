import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { REDIS_CONNECTOR, RedisConnector } from '../redis/redis.module'
import { API_ACTIVITY, ApiActivity } from '../shared/application/api-activity'
import { CLOCK, Clock } from '../shared/application/clock'
import { LOGGER, Logger } from '../shared/application/logger'
import { RATE_LIMIT_STORE, RATE_LIMITER, RateLimiter, RateLimitStore } from './application/rate-limiter'
import { MemoryRateLimitStore } from './infrastructure/memory-rate-limit.store'
import { RedisRateLimitStore } from './infrastructure/redis-rate-limit.store'
import { RateLimitGuard } from './presentation/rate-limit.guard'

@Global()
@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [CLOCK, REDIS_CONNECTOR, LOGGER],
      useFactory: (clock: Clock, connect: RedisConnector, logger: Logger): RateLimitStore => {
        const memory = new MemoryRateLimitStore(clock)
        return connect ? new RedisRateLimitStore(connect(), memory, logger) : memory
      }
    },
    {
      provide: RATE_LIMITER,
      inject: [RATE_LIMIT_STORE, API_ACTIVITY],
      useFactory: (store: RateLimitStore, activity: ApiActivity) => new RateLimiter(store, activity)
    },
    { provide: APP_GUARD, useClass: RateLimitGuard }
  ],
  exports: [RATE_LIMITER]
})
export class RateLimitModule {}
