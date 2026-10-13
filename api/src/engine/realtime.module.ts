import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ENGINE_PORT, EnginePort } from './application/engine-port'
import { GAME_EVENT_CONSUMERS, GameEventConsumer, GameEventDispatcher } from './application/game-event-dispatcher'
import { AchievementService } from '../achievements/application/achievement.service'
import { AchievementsModule } from '../achievements/achievements.module'
import { MapViewModule } from '../mapview/mapview.module'
import { MapStreamer } from '../mapview/presentation/map-streamer'
import { RealtimeGateway } from './presentation/realtime.gateway'
import { LOGGER, Logger } from '../shared/application/logger'

export const GAME_EVENT_DISPATCHER = Symbol('GameEventDispatcher')

// What the API process does with the engine's events: pushes them to the players' sockets and hands the game events to the
// consumers (design §24.1). The engine thread does not import it.
@Module({
  imports: [MapViewModule, AchievementsModule],
  providers: [
    RealtimeGateway,
    {
      provide: GAME_EVENT_CONSUMERS,
      inject: [RealtimeGateway, MapStreamer, AchievementService],
      useFactory: (gateway: RealtimeGateway, streamer: MapStreamer, achievements: AchievementService) => [
        gateway,
        streamer,
        achievements
      ]
    },
    {
      provide: GAME_EVENT_DISPATCHER,
      inject: [ENGINE_PORT, GAME_EVENT_CONSUMERS, LOGGER],
      useFactory: (engine: EnginePort, consumers: GameEventConsumer[], logger: Logger) =>
        new GameEventDispatcher(engine, consumers, logger)
    }
  ]
})
export class RealtimeModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private offUnlocks: (() => void) | null = null

  constructor(
    @Inject(GAME_EVENT_DISPATCHER) private readonly dispatcher: GameEventDispatcher,
    private readonly gateway: RealtimeGateway,
    private readonly achievements: AchievementService
  ) {}

  onApplicationBootstrap() {
    this.dispatcher.start()
    this.offUnlocks = this.achievements.onUnlocked((userId, unlock) =>
      this.gateway.push(userId, 'achievement-unlocked', unlock)
    )
  }

  onApplicationShutdown() {
    this.offUnlocks?.()
    this.dispatcher.stop()
  }
}
