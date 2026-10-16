import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common'
import { isMainThread } from 'worker_threads'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from './application/clock'
import { GAME_CLOCK, GAME_TIME, GameTimeState } from './application/game-clock'
import { ID_GENERATOR } from './application/id-generator'
import { LOG_BUFFER, LogBuffer } from './application/log-buffer'
import { LOGGER } from './application/logger'
import { RNG } from './application/rng'
import { TRACING, Tracing } from './application/tracing'
import { RecordingLogger } from './infrastructure/recording-logger'
import { SeededRng } from './infrastructure/seeded-rng'
import { SystemClock } from './infrastructure/system-clock'
import { Telemetry, TELEMETRY, telemetrySettings } from './infrastructure/telemetry'
import { UuidIdGenerator } from './infrastructure/uuid-id-generator'

// The engine thread reports as its own service next to the API thread of the same process
const serviceNameOf = (config: AppConfig) =>
  !isMainThread || config.deployment.role === 'engine' ? 'botrts-engine' : 'botrts-api'

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
      provide: TELEMETRY,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new Telemetry(telemetrySettings(config.observability, serviceNameOf(config)))
    },
    { provide: TRACING, inject: [TELEMETRY], useFactory: (telemetry: Telemetry): Tracing => telemetry.tracing },
    {
      provide: LOGGER,
      inject: [TELEMETRY, LOG_BUFFER, CLOCK],
      useFactory: (telemetry: Telemetry, buffer: LogBuffer, clock: Clock) =>
        new RecordingLogger(telemetry.logger('app'), buffer, clock)
    }
  ],
  exports: [CLOCK, GAME_CLOCK, GAME_TIME, ID_GENERATOR, RNG, LOGGER, LOG_BUFFER, TRACING, TELEMETRY]
})
export class SharedModule implements OnApplicationShutdown {
  constructor(@Inject(TELEMETRY) private readonly telemetry: Telemetry) {}

  // Sends what the exporters still hold before the process ends
  async onApplicationShutdown(): Promise<void> {
    await this.telemetry.shutdown()
  }
}
