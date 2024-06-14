import { Server } from 'socket.io'
import httpServer from 'http'
import { getLogger } from '../utils/logger'
// import { jobsService } from '../services/jobs'

const logger = getLogger('setup/socket-connection')

export function setupSocketServer(server: httpServer.Server) {
    const corsOptions = {
        origin: process.env.ADMIN_URL || 'http://localhost:5173',
        credentials: true
    }

    const io = new Server(server, {
        cors: corsOptions
    })

    // TODO: Fix auth middleware
    // io.use(isSocketAuthorized as any)

    io.on('connection', async (socket) => {
        const socketId = socket.id
        logger.info(`Socket client connected [${socketId}]`)

        await socket.join(socketId)

        // io.to(socketId).emit('update-jobs', jobsService.get())

        // const updateJobHandler = (...params: any) => io.to(socketId).emit('update-job', ...params)
        // const removeJobHandler = (...params: any) => io.to(socketId).emit('remove-job', ...params)

        // jobsService.jobsEventEmitter.on('update', updateJobHandler)
        // jobsService.jobsEventEmitter.on('remove', removeJobHandler)

        socket.conn.on('close', () => {
            logger.info(`Socket client disconnected [${socketId}]`)

            // jobsService.jobsEventEmitter.removeListener('update', updateJobHandler)
            // jobsService.jobsEventEmitter.removeListener('remove', removeJobHandler)
        })
    })
}
