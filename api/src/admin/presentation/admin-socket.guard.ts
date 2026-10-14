import { Socket } from 'socket.io'
import { isAdminRole } from '../../../../lib/utils/admin'
import { SOCKET_UNAUTHORIZED } from '../../../../lib/utils/constants'
import { SecondFactorService } from '../application/second-factor.service'

type Next = (error?: Error) => void

export const SOCKET_FORBIDDEN = 'Forbidden'
export const SOCKET_TWO_FACTOR_REQUIRED = 'Two-factor verification required'

// The rules of the admin namespace for a connection, after the handshake authenticated the caller: a session (never an API key)
// of an admin whose session passed the second factor. What each admin may listen to is decided per room by permission.
export function createAdminSocketGuard(secondFactor: Pick<SecondFactorService, 'isSessionVerified'>) {
  return async function guardAdminSocket(socket: Socket, next: Next): Promise<void> {
    const principal = socket.principal

    if (!principal) {
      return next(new Error(SOCKET_UNAUTHORIZED))
    }
    if (principal.apiKey || !isAdminRole(principal.user.status)) {
      return next(new Error(SOCKET_FORBIDDEN))
    }
    if (!(await secondFactor.isSessionVerified(principal.identity.sessionId))) {
      return next(new Error(SOCKET_TWO_FACTOR_REQUIRED))
    }

    return next()
  }
}
