import { Inject, OnApplicationShutdown } from '@nestjs/common'
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { IMapCell, MapPointType } from '../../../../lib/utils/interfaces/map'
import { ENGINE_PORT, EnginePort } from '../../engine/application/engine-port'
import { GameEventConsumer } from '../../engine/application/game-event-dispatcher'
import { EngineEvent } from '../../engine/application/engine-ports'
import { GameEvent } from '../../engine/domain/game-event'
import { roomOf } from '../../engine/presentation/realtime.gateway'
import { Clock } from '../../shared/application/clock'
import { GAME_CLOCK } from '../../shared/application/game-clock'
import { LOGGER, Logger } from '../../shared/application/logger'
import { MapViewService } from '../application/map-view.service'

// Pushes the changes of a player's map to the player's sockets as `map-cells` (design §4.4, §15.2): the batches of their live
// views, and their own bots as they move. The cells are fog-of-war safe by construction: a player gets only cells their own
// scanners saw or their own bots stand on. Where the live areas are goes out as `live-areas`.
@WebSocketGateway()
export class MapStreamer implements OnGatewayInit, OnApplicationShutdown, GameEventConsumer {
  private server: Server | null = null
  private off: (() => void) | null = null

  constructor(
    @Inject(ENGINE_PORT) private readonly engine: EnginePort,
    private readonly view: MapViewService,
    @Inject(GAME_CLOCK) private readonly clock: Clock,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  afterInit(server: Server) {
    this.server = server
    this.off = this.engine.onEvent((event) => this.forward(event))
  }

  onApplicationShutdown() {
    this.off?.()
  }

  // An own bot that moved leaves its old cell empty and stands on the new one
  async consume(userId: string, event: GameEvent) {
    const [mover] = event.parties
    if (event.type !== 'BotMoved' || mover.userId !== userId || !mover.botId) {
      return
    }

    const now = this.clock.now().getTime()
    const cells = await this.view.compose(userId, [
      { location: event.from, type: null, contentId: null, resource: null, seenAt: now },
      { location: event.to, type: MapPointType.BOT, contentId: mover.botId, resource: null, seenAt: now }
    ])
    this.send(userId, cells)
  }

  private forward(event: EngineEvent) {
    if (event.type === 'live-areas') {
      this.server?.to(roomOf(event.userId)).emit('live-areas', event.areas)
    } else if (event.type === 'vision') {
      this.view
        .compose(
          event.userId,
          event.cells.map((cell) => ({ ...cell, location: cell }))
        )
        .then((cells) => this.send(event.userId, cells))
        .catch((error) => this.logger.error(error))
    }
  }

  private send(userId: string, cells: IMapCell[]) {
    this.server?.to(roomOf(userId)).emit('map-cells', { now: this.clock.now().getTime(), cells })
  }
}
