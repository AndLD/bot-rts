import { Module } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from '../shared/application/clock'
import { RNG, Rng } from '../shared/application/rng'
import { SpawnService } from './application/spawn.service'
import { SPAWN_CONFIG, SpawnConfig } from './domain/spawn-config'

@Module({
  providers: [
    { provide: SPAWN_CONFIG, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.spawn },
    {
      provide: SpawnService,
      inject: [RNG, CLOCK, SPAWN_CONFIG],
      useFactory: (rng: Rng, clock: Clock, config: SpawnConfig) => new SpawnService(rng, clock, config)
    }
  ],
  exports: [SpawnService]
})
export class SpawnModule {}
