import httpServer from 'http'
import dotenv from 'dotenv'
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` })
import { getLogger } from '../utils/logger'
import { setupServer } from '../setup/server'
import { environment, FRONTEND_URL } from '../utils/constants'
import packageJson from '../package.json'
import { AppServices, createServices } from '../src/composition'

let server: httpServer.Server | null = null
let services: AppServices | null = null
const port = process.env.PORT || 8080

export async function startApp() {
  const logger = getLogger('setup/index')

  logger.info(`${packageJson.name} ${packageJson.version}. Starting app...`)

  services = createServices(process.env, FRONTEND_URL)
  server = setupServer(services)

  server.listen(port, () => {
    logger.info(`Server has been started on ${port}, env=${environment}`)
  })
}

export async function stopApp() {
  server?.close()
  await services?.close()
}
