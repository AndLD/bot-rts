import { Inject } from '@nestjs/common'
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { LOGGER, Logger } from '../../shared/application/logger'
import { guardKeySocket } from '../../apikeys/presentation/socket-key-guard'
import { RATE_LIMITER, RateLimiter } from '../../ratelimit/application/rate-limiter'
import { AuthService } from '../application/auth.service'
import { createSocketAuthMiddleware } from './socket-auth.middleware'

// Installs the handshake authentication (session or API key) once on the Socket.IO server that every gateway shares
@WebSocketGateway()
export class SocketAuthGateway implements OnGatewayInit {
  constructor(
    private readonly auth: AuthService,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter
  ) {}

  afterInit(server: Server) {
    const authenticate = createSocketAuthMiddleware(this.auth, this.logger)

    server.use(async (socket, next) => {
      await authenticate(socket, (error) => {
        if (!error) {
          // A connection of an API key is held to the scopes and the rate limit of the key
          guardKeySocket(socket, this.limiter)
        }
        next(error)
      })
    })
  }
}
