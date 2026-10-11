import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from './errors'

describe('shared errors', () => {
  it.each([
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ValidationError(), 400, 'VALIDATION_FAILED']
  ])('%p maps to HTTP %p', (error, statusCode, code) => {
    expect(error).toMatchObject({ statusCode, code })
  })

  it('accepts a custom message', () => {
    expect(new NotFoundError('Bot not found').message).toBe('Bot not found')
  })
})
