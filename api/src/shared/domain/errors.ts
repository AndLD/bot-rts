import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from './app-error'

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required') {
    super(401, ErrorCode.UNAUTHORIZED, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not allowed') {
    super(403, ErrorCode.FORBIDDEN, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, ErrorCode.NOT_FOUND, message)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(400, ErrorCode.VALIDATION_FAILED, message)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    readonly retryAfterSeconds: number,
    message = 'Too many requests'
  ) {
    super(429, ErrorCode.TOO_MANY_REQUESTS, message)
  }
}

export class RequestTimeoutError extends AppError {
  constructor(message = 'The request took too long') {
    super(503, ErrorCode.REQUEST_TIMEOUT, message)
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'The payload is too large') {
    super(413, ErrorCode.PAYLOAD_TOO_LARGE, message)
  }
}
