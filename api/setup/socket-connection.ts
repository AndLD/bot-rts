import httpServer from 'http'
import { Server } from 'socket.io'
import { createIsSocketAuthorized } from '../middlewares/authorization'
import { AppServices } from '../src/composition'
import { getLogger } from '../utils/logger'
import { registerBotHandlers } from './socket-handlers'

const logger = getLogger('setup/socket-connection')

export function setupSocketServer(server: httpServer.Server, services: AppServices) {
  const io = new Server(server, {
    cors: {
      origin: process.env.ADMIN_URL || 'http://localhost:5173',
      credentials: true
    }
  })

  io.use(createIsSocketAuthorized(services.users))

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
