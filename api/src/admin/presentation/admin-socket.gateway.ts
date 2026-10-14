import { Inject } from '@nestjs/common'
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Namespace } from 'socket.io'
import { ADMIN_SOCKET_NAMESPACE } from '../../../../lib/utils/admin'
import { AuthService } from '../../auth/application/auth.service'
import { createSocketAuthMiddleware } from '../../auth/presentation/socket-auth.middleware'
import { LOGGER, Logger } from '../../shared/application/logger'
import { SecondFactorService } from '../application/second-factor.service'
import { createAdminSocketGuard } from './admin-socket.guard'

// Installs the handshake of the admin Socket.IO namespace once: the token of the game, then the admin rules. The gateways of
// the console's features share the namespace and add what they push (rooms are joined by permission).
@WebSocketGateway({ namespace: ADMIN_SOCKET_NAMESPACE })
export class AdminSocketGateway implements OnGatewayInit {
  constructor(
    private readonly auth: AuthService,
    private readonly secondFactor: SecondFactorService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  afterInit(namespace: Namespace) {
    const authenticate = createSocketAuthMiddleware(this.auth, this.logger)
    const guard = createAdminSocketGuard(this.secondFactor)

    namespace.use((socket, next) => authenticate(socket, (error) => (error ? next(error) : void guard(socket, next))))
  }
}
