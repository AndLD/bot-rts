import { ArgumentsHost, NotFoundException } from '@nestjs/common'
import { Logger } from '../application/logger'
import { ForbiddenError } from '../domain/errors'
import { AppExceptionFilter } from './app-exception.filter'

function setup() {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

  return { filter: new AppExceptionFilter(logger), host, status, json, logger }
}

describe('AppExceptionFilter', () => {
  it('answers with the API error body and does not log expected errors', () => {
    const { filter, host, status, json, logger } = setup()

    filter.catch(new ForbiddenError('No'), host)
    filter.catch(new NotFoundException(), host)

    expect(status).toHaveBeenNthCalledWith(1, 403)
    expect(json).toHaveBeenNthCalledWith(1, { statusCode: 403, code: 'FORBIDDEN', error: 'No' })
    expect(status).toHaveBeenNthCalledWith(2, 404)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs unexpected errors and hides their details', () => {
    const { filter, host, status, json, logger } = setup()
    const error = new Error('secret')

    filter.catch(error, host)

    expect(logger.error).toHaveBeenCalledWith(error)
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ statusCode: 500, code: 'INTERNAL_ERROR', error: 'Internal server error' })
  })
})
