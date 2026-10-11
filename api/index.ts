import './setup/load-env'
import { bootstrap } from './src/bootstrap'
import { getLogger } from './utils/logger'

const logger = getLogger('index')

bootstrap(process.env).catch((error) => {
  logger.error(`Failed to start: ${error}`)
  process.exit(1)
})

process.on('uncaughtException', function (err) {
  logger.error(`UNCAUGHT EXCEPTION: ${err}`)
})

process.on('unhandledRejection', function (reason) {
  logger.error(`UNHANDLED REJECTION: ${reason}`)
})
