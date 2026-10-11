import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { HEALTH_PROBE, HealthProbe } from './application/health-probe'
import { HealthService } from './application/health.service'
import { PrismaHealthProbe } from './infrastructure/prisma-health-probe'
import { HealthController } from './presentation/health.controller'

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_PROBE,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaHealthProbe(client)
    },
    { provide: HealthService, inject: [HEALTH_PROBE], useFactory: (probe: HealthProbe) => new HealthService(probe) }
  ]
})
export class HealthModule {}
