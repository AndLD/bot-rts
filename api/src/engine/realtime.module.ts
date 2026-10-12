import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ENGINE_PORT, EnginePort } from './application/engine-port'
import { GAME_EVENT_CONSUMERS, GameEventConsumer, GameEventDispatcher } from './application/game-event-dispatcher'
import { MapViewModule } from '../mapview/mapview.module'
import { MapStreamer } from '../mapview/presentation/map-streamer'
import { RealtimeGateway } from './presentation/realtime.gateway'
import { LOGGER, Logger } from '../shared/application/logger'

export const GAME_EVENT_DISPATCHER = Symbol('GameEventDispatcher')

// What the API process does with the engine's events: pushes them to the players' sockets and hands the game events to the
// consumers (design §24.1). The engine thread does not import it.
@Module({
  imports: [MapViewModule],
  providers: [
    RealtimeGateway,
    {
      provide: GAME_EVENT_CONSUMERS,
      inject: [RealtimeGateway, MapStreamer],
      useFactory: (gateway: RealtimeGateway, streamer: MapStreamer) => [gateway, streamer]
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
  constructor(@Inject(GAME_EVENT_DISPATCHER) private readonly dispatcher: GameEventDispatcher) {}

  onApplicationBootstrap() {
    this.dispatcher.start()
  }

  onApplicationShutdown() {
    this.dispatcher.stop()
  }
}
