import { Socket } from 'socket.io'
import { SOCKET_UNAUTHORIZED } from '../../../../lib/utils/constants'
import { AdminPermission, hasPermission } from '../../../../lib/utils/admin'
import { SecondFactorService } from '../application/second-factor.service'

type Next = (error?: Error) => void

export const SOCKET_FORBIDDEN = 'Forbidden'
export const SOCKET_TWO_FACTOR_REQUIRED = 'Two-factor verification required'

// The rules of an admin route for a Socket.IO connection, after the handshake authenticated the caller: a session (never an API
// key) of an admin whose role holds the permission and whose session passed the second factor
export function createAdminSocketGuard(
  permission: AdminPermission,
  secondFactor: Pick<SecondFactorService, 'isSessionVerified'>
) {
  return async function guardAdminSocket(socket: Socket, next: Next): Promise<void> {
    const principal = socket.principal

    if (!principal) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }
    if (principal.apiKey || !hasPermission(principal.user.status, permission)) {
      return next(new Error(SOCKET_FORBIDDEN))
    }
    if (!(await secondFactor.isSessionVerified(principal.identity.sessionId))) {
      return next(new Error(SOCKET_TWO_FACTOR_REQUIRED))
    }

    return next()
  }
}
