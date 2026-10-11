import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../domain/app-error'
import { Logger } from '../application/logger'

export interface SocketError {
  code: number
  msg: string
}

// The acknowledgement of a Socket.IO event: the result, or null and the error
export type Ack = (result: unknown, error?: SocketError) => void

const ignoreAck: Ack = () => undefined

export function toSocketError(error: unknown): SocketError {
  return error instanceof AppError
    ? { code: error.statusCode, msg: error.message }
    : { code: 500, msg: ErrorCode.INTERNAL_ERROR }
}

// Wraps an event handler so a bad payload or a failing use case can neither throw into Socket.IO nor crash the process;
// failures go back to the client as an error acknowledgement
export function guarded(logger: Logger, handler: (ack: Ack, ...args: unknown[]) => Promise<void>) {
  return (...args: unknown[]) => {
    const last = args[args.length - 1]
    const ack = typeof last === 'function' ? (last as Ack) : ignoreAck
    const payload = typeof last === 'function' ? args.slice(0, -1) : args

    handler(ack, ...payload).catch((error) => {
      if (!(error instanceof AppError)) {
        logger.error(error)
      }
      ack(null, toSocketError(error))
    })
  }
}
