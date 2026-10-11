import { Server } from 'socket.io'
import httpServer from 'http'
import { getLogger } from '../utils/logger'
import { isSocketAuthorized } from '../middlewares/users'
import { botsService } from '../services/bots'
import { modulesService } from '../services/modules'
import { registerBotHandlers } from './socket-handlers'

const logger = getLogger('setup/socket-connection')

export function setupSocketServer(server: httpServer.Server) {
  const corsOptions = {
    origin: process.env.ADMIN_URL || 'http://localhost:5173',
    credentials: true
  }

  const io = new Server(server, {
    cors: corsOptions
  })

  io.use(isSocketAuthorized)

  io.on('connection', async (socket) => {
    const socketId = socket.id
    logger.info(`Socket client connected [${socketId}]`)

    await socket.join(socketId)

    registerBotHandlers(socket, {
      getUserBots: botsService.getUserBots,
      getBotById: botsService.getBotById,
      getBotModules: modulesService.getBotModules
    })

    socket.conn.on('close', () => {
      logger.info(`Socket client disconnected [${socketId}]`)
    })
  })
}
