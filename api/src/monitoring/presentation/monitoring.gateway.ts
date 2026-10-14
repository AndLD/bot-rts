import { Inject, OnApplicationShutdown } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { ADMIN_SOCKET_NAMESPACE, AdminServerToClientEvents, hasPermission } from '../../../../lib/utils/admin'
import { MONITORING_SERVICE, MonitoringService } from '../application/monitoring.service'
import { toHealthReport } from './monitoring.controller'

const ROOM = 'monitoring'

// The live dashboard (design §25.3): the health report is pushed after each sample to the consoles of admins who may see the
// dashboard. The handshake of the namespace is the admin gateway's.
@WebSocketGateway({ namespace: ADMIN_SOCKET_NAMESPACE })
export class MonitoringGateway implements OnGatewayInit, OnGatewayConnection, OnApplicationShutdown {
  private namespace: Namespace | null = null
  private off: (() => void) | null = null

  constructor(@Inject(MONITORING_SERVICE) private readonly monitoring: MonitoringService) {}

  afterInit(namespace: Namespace) {
    this.namespace = namespace
    this.off = this.monitoring.onSample((health) => this.broadcast(toHealthReport(health)))
  }

  // A console that connects gets the current report at once, not after the next sample
  handleConnection(socket: Socket) {
    if (!hasPermission((socket.principal as NonNullable<typeof socket.principal>).user.status, 'dashboard.read')) {
      return
    }
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
