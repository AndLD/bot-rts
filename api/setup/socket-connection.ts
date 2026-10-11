import httpServer from 'http'
import { Server } from 'socket.io'
import { createIsSocketAuthorized } from '../middlewares/authorization'
import { AppServices } from '../src/legacy/legacy-services'
import { getLogger } from '../utils/logger'
import { registerBotHandlers } from './socket-handlers'

const logger = getLogger('setup/socket-connection')

export function setupSocketServer(server: httpServer.Server, services: AppServices, adminUrl: string) {
  const io = new Server(server, {
    cors: {
      origin: adminUrl,
      credentials: true
    }
  })

  io.use(createIsSocketAuthorized(services.auth))

  io.on('connection', async (socket) => {
    const socketId = socket.id
    logger.info(`Socket client connected [${socketId}]`)

    await socket.join(socketId)

    registerBotHandlers(socket, services.bots)

    socket.conn.on('close', () => {
      logger.info(`Socket client disconnected [${socketId}]`)
    })
  })

  return io
}
