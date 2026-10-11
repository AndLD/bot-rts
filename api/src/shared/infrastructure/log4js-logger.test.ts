import { Log4jsLogger } from './log4js-logger'

describe('Log4jsLogger', () => {
  it('writes messages and errors without throwing', () => {
    const logger = new Log4jsLogger('test')

    expect(() => {
      logger.info('info')
      logger.warn('warn')
      logger.error(new Error('error'))
    }).not.toThrow()
  })
})
