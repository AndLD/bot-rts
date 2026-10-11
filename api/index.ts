import { startApp } from './setup'
import { getLogger } from './utils/logger'

const logger = getLogger('index')

startApp()

process.on('uncaughtException', function (err) {
  logger.error(`UNCAUGHT EXCEPTION: ${err}`)
})

process.on('unhandledRejection', function (reason) {
  logger.error(`UNHANDLED REJECTION: ${reason}`)
})
