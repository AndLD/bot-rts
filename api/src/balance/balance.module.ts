import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { BalanceService } from './application/balance.service'
import { EconomyService } from './application/economy.service'
import { BALANCE_REPOSITORY, BalanceRepository, ECONOMY_READ_MODEL, EconomyReadModel } from './application/ports'
import { PrismaBalanceRepository } from './infrastructure/prisma-balance.repository'
import { PrismaEconomyReadModel } from './infrastructure/prisma-economy-read-model'
import { BALANCE_SERVICE, BalanceController, ECONOMY_SERVICE } from './presentation/balance.controller'

// The Economy and balance page of the admin console
@Module({
  imports: [AdminModule, AuthModule],
  controllers: [BalanceController],
  providers: [
    {
      provide: BALANCE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaBalanceRepository(c)
    },
    {
      provide: ECONOMY_READ_MODEL,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaEconomyReadModel(c)
    },
    {
      provide: BALANCE_SERVICE,
      inject: [BALANCE_REPOSITORY, APP_CONFIG, CLOCK],
      useFactory: (versions: BalanceRepository, config: AppConfig, clock: Clock) =>
        new BalanceService(versions, config.balance.base, config.balance.version, config.balance.problem, clock)
    },
    {
      provide: ECONOMY_SERVICE,
      inject: [ECONOMY_READ_MODEL, APP_CONFIG],
      useFactory: (readModel: EconomyReadModel, config: AppConfig) =>
        new EconomyService(readModel, config.world.resources)
    }
  ]
})
export class BalanceModule {}
