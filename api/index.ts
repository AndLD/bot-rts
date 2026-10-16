import './src/load-env'
import { bootstrap } from './src/bootstrap'
import { ConsoleLogSink } from './src/shared/infrastructure/log-sinks'
import { TelemetryLogger } from './src/shared/infrastructure/telemetry-logger'

// Reports what goes wrong before the application exists (or outside it), to the console only
const logger = new TelemetryLogger('index', [
  new ConsoleLogSink(process.env.NODE_ENV === 'production' ? 'json' : 'text')
])

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
