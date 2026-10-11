import { Socket } from 'socket.io'
import { BOT_TYPE } from '../../lib/utils/interfaces/bots'
import { ErrorCode } from '../../lib/utils/error-codes'
import { BotsService } from '../src/bots/application/bots.service'
import { toBotDto } from '../src/bots/presentation/bot.mapper'
import { toModuleDto } from '../src/modules/presentation/module.mapper'
import { AppError } from '../src/shared/domain/app-error'
import { ValidationError } from '../src/shared/domain/errors'
import { isValidId } from '../src/shared/domain/ids'
import { getLogger } from '../utils/logger'

const logger = getLogger('setup/socket-handlers')

export type SocketBotsService = Pick<BotsService, 'listUserBots' | 'getBotModules'>

export interface SocketError {
  code: number
  msg: string
}

type Ack = (result: unknown, error?: SocketError) => void

const ignoreAck: Ack = () => undefined

function toSocketError(error: unknown): SocketError {
  return error instanceof AppError
    ? { code: error.statusCode, msg: error.message }
    : { code: 500, msg: ErrorCode.INTERNAL_ERROR }
}

// Wraps an event handler so a bad payload or a failing service can neither throw into Socket.IO nor crash the process
function guarded(handler: (ack: Ack, ...args: unknown[]) => Promise<void>) {
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

export function registerBotHandlers(socket: Socket, bots: SocketBotsService) {
  const userId = () => socket.user!._id

  socket.on(
    'get-user-bases',
    guarded(async (ack) => {
      ack((await bots.listUserBots(userId(), { type: BOT_TYPE.BASE })).map(toBotDto))
    })
  )

  socket.on(
    'get-user-bots',
    guarded(async (ack) => {
      ack((await bots.listUserBots(userId())).map(toBotDto))
    })
  )

  socket.on(
    'get-bot-modules',
    guarded(async (ack, botId) => {
      if (!isValidId(botId)) {
        throw new ValidationError('Invalid id')
      }

      ack((await bots.getBotModules(userId(), botId)).map(toModuleDto))
    })
  )
}
