import { Inject, OnApplicationShutdown } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { ServerToClientEvents } from '../../../../lib/utils/socket-events'
import { GameEvent } from '../domain/game-event'
import { EngineEvent } from '../application/engine-ports'
import { ENGINE_PORT, EnginePort } from '../application/engine-port'
import { GameEventConsumer } from '../application/game-event-dispatcher'

// The Socket.IO room of a player's connections
export const roomOf = (userId: string) => `user:${userId}`

// What the engine tells a player reaches every connection they have, as events of the game client: the game events the
// event bus lets them hear (`game-event`, also the animations of the map, §15.2), the changes of their radio signals
// (`radio-changes`), the batches of their live views (`vision`), and their scripts (`execution`, `script-log`).
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnApplicationShutdown, GameEventConsumer {
  private server: Server | null = null
  private off: (() => void) | null = null

  constructor(@Inject(ENGINE_PORT) private readonly engine: EnginePort) {}

  afterInit(server: Server) {
    this.server = server
    this.off = this.engine.onEvent((event) => this.forward(event))
  }

  handleConnection(socket: Socket) {
    const principal = socket.principal as NonNullable<typeof socket.principal>
    void socket.join(roomOf(principal.user.id))
  }

  onApplicationShutdown() {
    this.off?.()
  }

  // The game events come through the dispatcher, like for any consumer
  consume(userId: string, event: GameEvent) {
    this.server?.to(roomOf(userId)).emit('game-event', event)
  }

  // Tells a player's connections of something that is not a game event of the engine, such as an achievement
  push<E extends keyof ServerToClientEvents>(userId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>) {
    this.server?.to(roomOf(userId)).emit(event, ...args)
  }

  // Tells every connected player, on every node (the Socket.IO adapter carries it across them)
  broadcast<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) {
    this.server?.emit(event, ...args)
  }

  private forward(event: EngineEvent) {
    switch (event.type) {
      case 'radio':
        this.server?.to(roomOf(event.userId)).emit('radio-changes', event.changes)
        break
      case 'vision':
        this.server?.to(roomOf(event.userId)).emit('vision', event)
        break
      case 'execution':
        this.server?.to(roomOf(event.userId)).emit('execution', event.execution)
        break
      case 'log':
        this.server?.to(roomOf(event.userId)).emit('script-log', event)
        break
      default:
        // Game events are not forwarded here: the dispatcher hands them to `consume`
        break
    }
  }
}
