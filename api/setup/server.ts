import httpServer from 'http'
import { AppServices } from '../src/composition'
import { setupApp } from './app'
import { setupRouters } from './routers'
import { setupSocketServer } from './socket-connection'

export function setupServer(services: AppServices) {
  const app = setupApp()
  setupRouters(app, services)

  const server = httpServer.createServer(app)
  setupSocketServer(server, services)

  return server
}
