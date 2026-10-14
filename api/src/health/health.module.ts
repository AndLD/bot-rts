import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { REDIS_CONNECTOR, RedisConnector } from '../redis/redis.module'
import { HEALTH_CHECKS, HealthCheck } from './application/health-check'
import { HealthService } from './application/health.service'
import { EngineHealthCheck } from './infrastructure/engine-health-check'
import { PrismaHealthCheck } from './infrastructure/prisma-health-check'
import { RedisHealthCheck } from './infrastructure/redis-health-check'
import { HealthController } from './presentation/health.controller'

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_CHECKS,
      inject: [PRISMA_CLIENT, APP_CONFIG, REDIS_CONNECTOR, ENGINE_PORT],
      useFactory: (client: PrismaClient, config: AppConfig, connect: RedisConnector, engine: EnginePort) => [
        new PrismaHealthCheck(client),
        ...(connect ? [new RedisHealthCheck(connect())] : []),
        ...(config.engine.isEnabled ? [new EngineHealthCheck(engine)] : [])
      ]
    },
    {
      provide: HealthService,
      inject: [HEALTH_CHECKS],
      useFactory: (checks: HealthCheck[]) => new HealthService(checks)
    }
  ]
})
export class HealthModule {}
