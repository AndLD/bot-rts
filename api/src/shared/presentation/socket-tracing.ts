import type { Server, Socket } from 'socket.io'
import { SocketError } from './socket-handlers'
import { Tracing } from '../application/tracing'

// Gives every Socket.IO event the span of its handler: what the handler logs and sends on to the engine belongs to it. The span
// ends when the event is acknowledged; an event nobody acknowledges ends it once the handler has had its first turn.
export function traceSocketEvents(server: Pick<Server, 'on'>, tracing: Tracing): void {
  server.on('connection', (socket: Socket) => {
    socket.use((packet, next) => {
      const event = String(packet[0])
      const span = tracing.startSpan(`socket ${event}`, {
        kind: 'server',
        attributes: { 'messaging.system': 'socket.io', 'messaging.destination.name': event }
      })
      const ack = packet[packet.length - 1]

      if (typeof ack === 'function') {
        // The acknowledgement goes on with exactly the arguments the handler gave it
        packet[packet.length - 1] = (...answer: unknown[]) => {
          const error = answer[1] as SocketError | undefined
          if (error) {
            span.fail(error.msg)
          }
          span.end()
          ack(...answer)
        }
      } else {
        setImmediate(() => span.end())
      }
      span.run(next)
    })
  })
}
