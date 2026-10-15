import { Inject, Module, OnModuleInit } from '@nestjs/common'
import { ENGINE_PORT, EnginePort } from '../engine/application/engine-port'
import { RealtimeGateway } from '../engine/presentation/realtime.gateway'
import { RealtimeModule } from '../engine/realtime.module'
import { GAME_CLOCK, GAME_TIME, GameTimeSource } from '../shared/application/game-clock'
import { Clock } from '../shared/application/clock'
import { GameTimeService } from './application/game-time.service'
import { GameTimeSettingsService } from './application/game-time-settings.service'
import { GameTimeCoreModule } from './game-time-core.module'
import { GameTimeController } from './presentation/game-time.controller'

// The game's time on the API side: what clients read, and what a change does. A change is told to the engine and then to every connected
// client, so the clients read the new time only after the engine follows it (design §25.3, Game time).
@Module({
  imports: [GameTimeCoreModule, RealtimeModule],
  controllers: [GameTimeController],
  providers: [
    {
      provide: GameTimeService,
      inject: [GAME_CLOCK, GAME_TIME, GameTimeSettingsService],
      useFactory: (clock: Clock, time: GameTimeSource, settings: GameTimeSettingsService) =>
        new GameTimeService(clock, time, settings)
    }
  ],
  exports: [GameTimeService, GameTimeCoreModule]
})
export class TimeModule implements OnModuleInit {
  constructor(
    private readonly settings: GameTimeSettingsService,
    @Inject(ENGINE_PORT) private readonly engine: EnginePort,
    private readonly gateway: RealtimeGateway
  ) {}

  onModuleInit() {
    this.settings.onChange(async (settings) => {
      await this.engine.setGameTime(settings)
      this.gateway.broadcast('game-time-changed')
    })
  }
}
