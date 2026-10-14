import { Inject, OnApplicationShutdown } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { AdminServerToClientEvents } from '../../../../lib/utils/admin'
import { createAdminSocketGuard } from '../../admin/presentation/admin-socket.guard'
import { SecondFactorService } from '../../admin/application/second-factor.service'
import { AuthService } from '../../auth/application/auth.service'
import { createSocketAuthMiddleware } from '../../auth/presentation/socket-auth.middleware'
import { LOGGER, Logger } from '../../shared/application/logger'
import { MONITORING_SERVICE, MonitoringService } from '../application/monitoring.service'
import { toHealthReport } from './monitoring.controller'

const ROOM = 'monitoring'

// The live dashboard (design §25.3): the health report is pushed to every connected console after each sample. The namespace
// has its own handshake: the same token as the game, then the admin rules.
@WebSocketGateway({ namespace: '/admin' })
export class MonitoringGateway implements OnGatewayInit, OnGatewayConnection, OnApplicationShutdown {
  private namespace: Namespace | null = null
  private off: (() => void) | null = null

  constructor(
    @Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService,
    private readonly auth: AuthService,
    private readonly secondFactor: SecondFactorService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  afterInit(namespace: Namespace) {
    this.namespace = namespace
    const authenticate = createSocketAuthMiddleware(this.auth, this.logger)
    const guard = createAdminSocketGuard('dashboard.read', this.secondFactor)

    namespace.use((socket, next) => authenticate(socket, (error) => (error ? next(error) : void guard(socket, next))))
    this.off = this.monitoring.onSample((health) => this.broadcast(toHealthReport(health)))
  }

  // A console that connects gets the current report at once, not after the next sample
  handleConnection(socket: Socket) {
    void socket.join(ROOM)
    socket.emit('monitoring-health', toHealthReport(this.monitoring.health()))
  }

  onApplicationShutdown() {
    this.off?.()
  }

  private broadcast(report: Parameters<AdminServerToClientEvents['monitoring-health']>[0]) {
    this.namespace?.to(ROOM).emit('monitoring-health', report)
  }
}
