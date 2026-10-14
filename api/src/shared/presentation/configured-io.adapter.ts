import { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { ServerOptions } from 'socket.io'

// Where an adapter that shares rooms between API nodes gets its two Redis connections (publish and subscribe)
export interface RoomSharing {
  publisher: Redis
  subscriber: Redis
}

// Socket.IO with the allowed origins taken from the configuration instead of a decorator constant (the same list as CORS). With `sharing` the rooms
// and broadcasts span every API node (Redis adapter), which keeps a socket stateless: its player's room is rejoined on
// whichever node accepts the connection.
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly isAllowedOrigin: (origin: string | undefined) => boolean,
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

    if (this.sharing) {
      server.adapter(createAdapter(this.sharing.publisher, this.sharing.subscriber))
    }

    return server
  }
}
