import { Inject, OnApplicationShutdown } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { ADMIN_SOCKET_NAMESPACE, hasPermission } from '../../../../lib/utils/admin'
import { ENGINE_PORT, EnginePort } from '../../engine/application/engine-port'

const ROOM = 'game-event-tail'

// The live event tail of the world map (design §25.3): every game event of the world, to the consoles of admins who may see the
// map. Unlike a player's `game-event`, it is not filtered by who may hear of it.
@WebSocketGateway({ namespace: ADMIN_SOCKET_NAMESPACE })
export class InspectorTailGateway implements OnGatewayInit, OnGatewayConnection, OnApplicationShutdown {
  private off: (() => void) | null = null

  constructor(@Inject(ENGINE_PORT) private readonly engine: EnginePort) {}

  afterInit(namespace: Namespace) {
    this.off = this.engine.onEvent((event) => {
      if (event.type === 'game') {
        namespace.to(ROOM).emit('game-event-tail', { userId: event.userId, event: event.event })
      }
    })
  }

  handleConnection(socket: Socket) {
    if (hasPermission((socket.principal as NonNullable<typeof socket.principal>).user.status, 'map.read')) {
      void socket.join(ROOM)
    }
  }

  onApplicationShutdown() {
    this.off?.()
  }
}
