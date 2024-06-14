import httpServer from 'http'
import dotenv from 'dotenv'
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` })
import { getLogger } from '../utils/logger'
import { setupServer } from '../setup/server'
import { environment } from '../utils/constants'
import { dbService } from '../services/db'
import packageJson from '../package.json'

let server: httpServer.Server | null = null
const port = process.env.PORT || 8080

export async function startApp() {
    const logger = getLogger('setup/index')

    logger.info(`${packageJson.name} ${packageJson.version}. Starting app...`)

    server = setupServer()

    await dbService.init()

    server.listen(port, () => {
        logger.info(`Server has been started on ${port}, env=${environment}`)
    })
}

export async function stopApp() {
    if (server) {
        server.close()
    }

    await dbService.close()
}
