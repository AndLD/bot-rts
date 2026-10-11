import { Socket } from 'socket.io'
import { BOT_TYPE, IBot } from '../../lib/utils/interfaces/bots'
import { ModuleProps } from '@lib/utils/interfaces/modules'
import { errors } from '../utils/constants'
import { isValidId } from '../utils/objectId'
import { getLogger } from '../utils/logger'

const logger = getLogger('setup/socket-handlers')

export interface SocketServices {
  getUserBots(userId: string, filter?: { type?: BOT_TYPE }): Promise<IBot[]>
  getBotById(id: string): Promise<IBot | null>
  getBotModules(botId: string): Promise<ModuleProps[]>
}

type Ack = (result: unknown, error?: { code: number; msg: string }) => void

const ignoreAck: Ack = () => undefined

// Wraps an event handler so a bad payload or a failing service can neither throw into Socket.IO nor crash the process
function guarded(handler: (ack: Ack, ...args: unknown[]) => Promise<void>) {
  return (...args: unknown[]) => {
    const last = args[args.length - 1]
    const ack = typeof last === 'function' ? (last as Ack) : ignoreAck
    const payload = typeof last === 'function' ? args.slice(0, -1) : args

    handler(ack, ...payload).catch((err) => {
      logger.error(err)
      ack(null, errors.INTERNAL_SERVER_ERROR)
    })
  }
}

export function registerBotHandlers(socket: Socket, services: SocketServices) {
  const userId = () => socket.user!._id

  socket.on(
    'get-user-bases',
    guarded(async (ack) => {
      ack(await services.getUserBots(userId(), { type: BOT_TYPE.BASE }))
    })
  )

  socket.on(
    'get-user-bots',
    guarded(async (ack) => {
      ack(await services.getUserBots(userId()))
    })
  )

  socket.on(
    'get-bot-modules',
    guarded(async (ack, botId) => {
      if (!isValidId(botId)) {
        return ack(null, errors.INVALID_ID)
      }

      const bot = await services.getBotById(botId)

      if (!bot) {
        return ack(null, errors.DOC_NOT_FOUND)
      }
      if (bot.userId !== userId()) {
        return ack(null, errors.FORBIDDEN)
      }

      ack(await services.getBotModules(botId))
    })
  )
}
