import Redis from 'ioredis'
import { HealthCheck } from '../application/health-check'

export class RedisHealthCheck implements HealthCheck {
  readonly component = 'redis'

  constructor(private readonly redis: Redis) {}

  async check(): Promise<void> {
    await this.redis.ping()
  }
}
