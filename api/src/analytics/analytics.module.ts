import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { AnalyticsService } from './application/analytics.service'
import { ANALYTICS_READ_MODEL, AnalyticsReadModel } from './application/ports'
import { PrismaAnalyticsReadModel } from './infrastructure/prisma-analytics-read-model'
import { ANALYTICS_SERVICE, AnalyticsController } from './presentation/analytics.controller'

// The Analytics page of the admin console
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [
    {
      provide: ANALYTICS_READ_MODEL,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaAnalyticsReadModel(client)
    },
    {
      provide: ANALYTICS_SERVICE,
      inject: [ANALYTICS_READ_MODEL, CLOCK],
      useFactory: (readModel: AnalyticsReadModel, clock: Clock) => new AnalyticsService(readModel, clock)
    }
  ]
})
export class AnalyticsModule {}
