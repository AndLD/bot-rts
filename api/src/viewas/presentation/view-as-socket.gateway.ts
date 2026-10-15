import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { ClientToServerEvents, SocketAck } from '../../../../lib/utils/socket-events'
import { AuditService } from '../../admin/application/audit.service'
import { SOCKET_EVENT_SCOPES } from '../../apikeys/presentation/socket-key-guard'
import { ViewAsReadOnlyError } from '../../auth/domain/view-as.errors'
import { toSocketError } from '../../shared/presentation/socket-handlers'

type Packet = [string, ...unknown[]]

// Events whose reads are sensitive and so audited, with the name written to the trail
const AUDITED_EVENTS: Readonly<Record<string, string>> = { 'get-terminal-history': 'terminal.history' }

// The connection of a "view as player" session may only read: any event that is not a read of the game client is answered with
// VIEW_AS_READ_ONLY through its acknowledgement and never reaches its handler. Sensitive reads are audited first.
@WebSocketGateway()
export class ViewAsSocketGateway implements OnGatewayConnection {
  constructor(private readonly audit: AuditService) {}

  handleConnection(socket: Socket) {
    const view = socket.principal?.viewAs

    if (!view) {
      return
    }

    socket.use(async ([event, ...args]: Packet, next) => {
      try {
        if (SOCKET_EVENT_SCOPES[event as keyof ClientToServerEvents] !== 'read') {
          throw new ViewAsReadOnlyError()
        }
        if (AUDITED_EVENTS[event]) {
          await this.audit.record({
            actorId: view.adminId,
            actorRole: view.adminStatus,
            action: `view-as.${AUDITED_EVENTS[event]}`,
            outcome: 'success',
            targetType: 'player',
            targetId: (socket.principal as NonNullable<typeof socket.principal>).user.id,
            reason: typeof args[0] === 'string' ? args[0] : null,
            before: null,
            after: null,
            ip: socket.handshake.address ?? null,
            requestId: null
          })
        }
        next()
      } catch (error) {
        const ack = args[args.length - 1] as SocketAck<never> | unknown

        if (typeof ack === 'function') {
          const answer = ack as SocketAck<never>

          answer(null, toSocketError(error))
        }
      }
    })
  }
}
