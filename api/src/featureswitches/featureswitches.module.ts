import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { PrismaClient } from '@prisma/client'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import {
  FEATURE_SWITCH_STORE,
  FeatureSwitchesService,
  FeatureSwitchStore
} from './application/feature-switches.service'
import { PrismaFeatureSwitchStore } from './infrastructure/prisma-feature-switch.store'
import { FeatureGuard } from './presentation/feature.guard'
import { AdminFeaturesController, FeaturesController } from './presentation/features.controller'

// The switches of whole features of the game (design §25.3). Global, because the guards and use cases of other features ask it
// whether their feature is on.
@Global()
@Module({
  controllers: [FeaturesController, AdminFeaturesController],
  providers: [
    {
      provide: FEATURE_SWITCH_STORE,
      inject: [PRISMA_CLIENT],
      useFactory: (c: PrismaClient) => new PrismaFeatureSwitchStore(c)
    },
    {
      provide: FeatureSwitchesService,
      inject: [FEATURE_SWITCH_STORE, CLOCK, APP_CONFIG],
      useFactory: (store: FeatureSwitchStore, clock: Clock, config: AppConfig) =>
        new FeatureSwitchesService(store, clock, config.featureSwitchCacheMs)
    },
    { provide: APP_GUARD, useClass: FeatureGuard }
  ],
  exports: [FeatureSwitchesService]
})
export class FeatureSwitchesModule {}
