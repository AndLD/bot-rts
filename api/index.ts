import './src/load-env'
import { bootstrap } from './src/bootstrap'
import { Log4jsLogger } from './src/shared/infrastructure/log4js-logger'

const logger = new Log4jsLogger('index')

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
