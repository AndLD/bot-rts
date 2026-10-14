import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import Redis from 'ioredis'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { connectRedis } from './infrastructure/redis-connection'

export const REDIS_CONNECTOR = Symbol('RedisConnector')

// Opens a new Redis connection (a subscriber needs a connection of its own); `null` when no Redis is configured
export type RedisConnector = (() => Redis) | null

export class RedisConnections {
  private readonly open: Redis[] = []

  constructor(private readonly url: string | undefined) {}

  get connector(): RedisConnector {
    const url = this.url
    if (!url) {
      return null
    }
    return () => {
      const connection = connectRedis(url)
      this.open.push(connection)
      return connection
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.open.map((connection) => connection.quit().catch(() => connection.disconnect())))
  }
}

const REDIS_CONNECTIONS = Symbol('RedisConnections')

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTIONS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new RedisConnections(config.deployment.redisUrl)
    },
    { provide: REDIS_CONNECTOR, inject: [REDIS_CONNECTIONS], useFactory: (c: RedisConnections) => c.connector }
  ],
  exports: [REDIS_CONNECTOR]
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CONNECTIONS) private readonly connections: RedisConnections) {}

  async onApplicationShutdown() {
    await this.connections.closeAll()
  }
}
