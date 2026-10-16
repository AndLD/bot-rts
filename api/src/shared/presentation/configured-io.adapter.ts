import { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { Server, ServerOptions, Socket } from 'socket.io'
import { ApiActivity } from '../application/api-activity'
import { Clock } from '../application/clock'
import { Tracing } from '../application/tracing'
import { traceSocketEvents } from './socket-tracing'

// Where an adapter that shares rooms between API nodes gets its two Redis connections (publish and subscribe)
export interface RoomSharing {
  publisher: Redis
  subscriber: Redis
}

// Tells the traffic counters when a socket opens and closes, and whose it is (the handshake has authenticated it by then)
function countSockets(server: Pick<Server, 'on'>, activity: ApiActivity, clock: Clock): void {
  server.on('connection', (socket: Socket) => {
    const userId = socket.principal?.user.id
    activity.socketOpened(userId, clock.now().getTime())
    socket.on('disconnect', () => activity.socketClosed(userId, clock.now().getTime()))
  })
}

// Socket.IO with the allowed origins taken from the configuration instead of a decorator constant (the same list as CORS). With `sharing` the rooms
// and broadcasts span every API node (Redis adapter), which keeps a socket stateless: its player's room is rejoined on
// whichever node accepts the connection.
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly isAllowedOrigin: (origin: string | undefined) => boolean,
    private readonly tracing: Tracing,
    private readonly activity: ApiActivity,
    private readonly clock: Clock,
    private readonly sharing?: RoomSharing
  ) {
    super(app)
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
          callback(null, this.isAllowedOrigin(origin)),
        credentials: true
      }
    })

    traceSocketEvents(server, this.tracing)
    countSockets(server, this.activity, this.clock)

    if (this.sharing) {
      server.adapter(createAdapter(this.sharing.publisher, this.sharing.subscriber))
    }

    return server
  }
}
