import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK } from './application/clock'
import { ID_GENERATOR } from './application/id-generator'
import { LOGGER } from './application/logger'
import { RNG } from './application/rng'
import { Log4jsLogger } from './infrastructure/log4js-logger'
import { SeededRng } from './infrastructure/seeded-rng'
import { SystemClock } from './infrastructure/system-clock'
import { UuidIdGenerator } from './infrastructure/uuid-id-generator'

// Clock, ids, randomness and logging are shared by every feature
@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
    {
      provide: RNG,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new SeededRng(config.worldSeed ?? Date.now())
    },
    { provide: LOGGER, useFactory: () => new Log4jsLogger('app') }
  ],
  exports: [CLOCK, ID_GENERATOR, RNG, LOGGER]
})
export class SharedModule {}
