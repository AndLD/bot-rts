import { Socket } from 'socket.io'
import { ApiScope } from '../../../../lib/utils/interfaces/api-keys'
import { ClientToServerEvents, SocketAck } from '../../../../lib/utils/socket-events'
import { RateLimiter } from '../../ratelimit/application/rate-limiter'
import { ApiKeyScopeError } from '../domain/api-key.errors'
import { toSocketError } from '../../shared/presentation/socket-handlers'

const MINUTE_MS = 60_000

// The scope each event of the game client needs from an API key. The type makes the list exhaustive: an event added to
// `ClientToServerEvents` does not compile until it is given a scope here.
export const SOCKET_EVENT_SCOPES: Record<keyof ClientToServerEvents, ApiScope> = {
  'get-user-bases': 'read',
  'get-user-bots': 'read',
  'get-bot-modules': 'read',
  'get-factory': 'read',
  'get-map': 'read',
  'get-terminal-history': 'read',
  'craft-module': 'fabrication',
  'research-module': 'fabrication',
  'learn-blueprint': 'fabrication',
  'assemble-bot': 'fabrication',
  'open-terminal': 'terminal',
  'close-terminal': 'terminal',
  'terminal-command': 'terminal',
  'save-terminal-file': 'terminal'
}

type Packet = [string, ...unknown[]]

// Holds the connection of an API key to the scopes of the key and to its rate limit, event by event. A refused event is answered
// through its acknowledgement, like the errors of the handlers; the handler never sees it. Sessions are not touched.
export function guardKeySocket(socket: Socket, limiter: RateLimiter): void {
  const grant = socket.principal?.apiKey
  if (!grant) {
    return
  }

  socket.use(async ([event, ...args]: Packet, next) => {
    try {
      const scope = SOCKET_EVENT_SCOPES[event as keyof ClientToServerEvents]
      if (!scope || !grant.scopes.includes(scope)) {
        throw new ApiKeyScopeError(scope ?? event)
      }
      await limiter.consume('key', grant.id, { limit: grant.ratePerMinute, windowMs: MINUTE_MS })
      next()
    } catch (error) {
      const ack = args[args.length - 1] as SocketAck<never> | unknown
      if (typeof ack === 'function') {
        const answer: SocketAck<never> = ack as SocketAck<never>
        answer(null, toSocketError(error))
      }
    }
  })
}
