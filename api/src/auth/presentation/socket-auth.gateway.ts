import { Inject } from '@nestjs/common'
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { LOGGER, Logger } from '../../shared/application/logger'
import { AuthService } from '../application/auth.service'
import { createSocketAuthMiddleware } from './socket-auth.middleware'

// Installs the handshake authentication once on the Socket.IO server that every gateway shares
@WebSocketGateway()
export class SocketAuthGateway implements OnGatewayInit {
  constructor(
    private readonly auth: AuthService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  afterInit(server: Server) {
    server.use(createSocketAuthMiddleware(this.auth, this.logger))
  }
}
