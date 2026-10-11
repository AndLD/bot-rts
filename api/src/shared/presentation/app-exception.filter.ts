import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { Response } from 'express'
import { Logger } from '../application/logger'
import { isUnexpected, toErrorResponse } from './error-response'

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (isUnexpected(exception)) {
      this.logger.error(exception)
    }

    const body = toErrorResponse(exception)
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body)
  }
}
