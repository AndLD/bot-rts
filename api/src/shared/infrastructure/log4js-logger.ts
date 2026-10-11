import type { Logger as Log4jsInstance } from 'log4js'
import { getLogger } from '../../../utils/logger'
import { Logger } from '../application/logger'

// log4js is configured (appenders, level) by utils/logger.ts when that module loads
export class Log4jsLogger implements Logger {
  private readonly logger: Log4jsInstance

  constructor(category: string) {
    this.logger = getLogger(category)
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
