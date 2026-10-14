import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AppError } from '../domain/app-error'
import { isUnexpected, toErrorResponse } from './error-response'

describe('toErrorResponse', () => {
  it('keeps the status, code and message of an AppError', () => {
    expect(toErrorResponse(new AppError(409, 'CONFLICT', 'Taken'))).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
      error: 'Taken'
    })
  })

  it('maps Nest HTTP exceptions without exposing their details', () => {
    expect(toErrorResponse(new NotFoundException('Cannot GET /x'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      error: 'Not found'
    })
    expect(toErrorResponse(new BadRequestException(['name must be a string']))).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'Invalid request'
    })
  })

  it('maps client errors raised by Express and falls back to a generic code', () => {
    expect(toErrorResponse({ status: 429 }).code).toBe('TOO_MANY_REQUESTS')
    expect(toErrorResponse({ status: 413 }).code).toBe('PAYLOAD_TOO_LARGE')    expect(toErrorResponse({ status: 418 })).toMatchObject({ statusCode: 418, code: 'VALIDATION_FAILED' })
  })

  it('hides unexpected errors', () => {
    expect(toErrorResponse(new Error('db password is hunter2'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      error: 'Internal server error'
    })
    expect(toErrorResponse({ status: 503 }).statusCode).toBe(500)
  })
})

describe('isUnexpected', () => {
  it('is true only for server errors', () => {
    expect(isUnexpected(new Error('boom'))).toBe(true)
    expect(isUnexpected(new AppError(404, 'NOT_FOUND', 'x'))).toBe(false)
  })
})
