import log4js from 'log4js'
import { Logger } from '../application/logger'

const startedAt = new Date().toISOString().replace(/[:.]/g, '-')

log4js.configure({
  appenders: {
    file: { type: 'file', filename: `logs/${startedAt}.log` },
    con: { type: 'console' }
  },
  categories: {
    default: { appenders: ['file', 'con'], level: 'info' }
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
