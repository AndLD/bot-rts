import log4js from 'log4js'
import { Logger } from '../application/logger'
import { formatEvent, readLogSettings } from './log-format'
import { currentRequestId } from '../application/request-context'

const startedAt = new Date().toISOString().replace(/[:.]/g, '-')
const settings = readLogSettings(process.env)

log4js.addLayout('botrts', () => (event) => formatEvent(event, settings.format, currentRequestId()))

log4js.configure({
  appenders: {
    file: { type: 'file', filename: `logs/${startedAt}.log`, layout: { type: 'botrts' } },
    con: { type: 'console', layout: { type: 'botrts' } }
  },
  categories: {
    default: { appenders: settings.isFileEnabled ? ['file', 'con'] : ['con'], level: 'info' }
  }
})

export class Log4jsLogger implements Logger {
  private readonly logger: log4js.Logger

  constructor(category: string) {
    this.logger = log4js.getLogger(category)
  }

  info(message: string): void {
    this.logger.info(message)
  }

  warn(message: string): void {
    this.logger.warn(message)
  }

  error(error: unknown): void {
    this.logger.error(error)
  }
}
