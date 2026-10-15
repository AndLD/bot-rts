import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from './application/clock'
import { GAME_CLOCK, GAME_TIME, GameTimeState } from './application/game-clock'
import { ID_GENERATOR } from './application/id-generator'
import { LOG_BUFFER, LogBuffer } from './application/log-buffer'
import { LOGGER } from './application/logger'
import { RNG } from './application/rng'
import { Log4jsLogger } from './infrastructure/log4js-logger'
import { RecordingLogger } from './infrastructure/recording-logger'
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
    {
      provide: LOG_BUFFER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new LogBuffer(config.observability.logBufferSize)
    },
    {
      provide: GAME_TIME,
      inject: [CLOCK, APP_CONFIG],
      useFactory: (clock: Clock, config: AppConfig) => new GameTimeState(clock, config.nodeEnv === 'production')
    },
    { provide: GAME_CLOCK, inject: [GAME_TIME], useFactory: (state: GameTimeState) => state.clock },
    {
      provide: LOGGER,
      inject: [LOG_BUFFER, CLOCK],
      useFactory: (buffer: LogBuffer, clock: Clock) => new RecordingLogger(new Log4jsLogger('app'), buffer, clock)
    }
  ],
  exports: [CLOCK, GAME_CLOCK, GAME_TIME, ID_GENERATOR, RNG, LOGGER, LOG_BUFFER]
})
export class SharedModule {}
