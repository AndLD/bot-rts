import { HttpException, HttpStatus } from '@nestjs/common'
import { ErrorCode } from '../../../../lib/utils/error-codes'
import { AppError } from '../domain/app-error'

export interface ErrorResponse {
  statusCode: number
  code: string
  // The human-readable message; the field name predates the typed codes and the client already reads it
  error: string
}

const CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  429: ErrorCode.TOO_MANY_REQUESTS
}

function fromHttpStatus(statusCode: number, message: string): ErrorResponse {
  return { statusCode, code: CODE_BY_STATUS[statusCode] ?? ErrorCode.VALIDATION_FAILED, error: message }
}

// Maps any thrown value to the error body of the API; unexpected errors never leak their message
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, error: error.message }
  }

  if (error instanceof HttpException) {
    const statusCode = error.getStatus()
    const message = statusCode === HttpStatus.NOT_FOUND ? 'Not found' : 'Invalid request'

    return fromHttpStatus(statusCode, message)
  }

  const status = (error as { status?: unknown }).status

  // Malformed JSON and similar client mistakes raised by Express itself
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return fromHttpStatus(status, 'Invalid request')
  }

  return { statusCode: 500, code: ErrorCode.INTERNAL_ERROR, error: 'Internal server error' }
}

export function isUnexpected(error: unknown): boolean {
  return toErrorResponse(error).statusCode >= 500
}
