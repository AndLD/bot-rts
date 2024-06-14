import { setupApp } from './app'
import httpServer from 'http'
import { setupRouters } from './routers'
import { setupSocketServer } from './socket-connection'

export function setupServer() {
    const app = setupApp()
    setupRouters(app)

    const server = httpServer.createServer(app)
    setupSocketServer(server)

    return server
}
