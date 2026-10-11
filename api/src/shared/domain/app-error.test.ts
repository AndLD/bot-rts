import { AppError } from './app-error'

class NotFoundError extends AppError {
  constructor() {
    super(404, 'NOT_FOUND', 'Not found')
  }
}

describe('AppError', () => {
  it('carries the status code, code and message', () => {
    const error = new AppError(400, 'BAD_REQUEST', 'Bad request')

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST', message: 'Bad request', name: 'AppError' })
  })

  it('names subclasses after themselves', () => {
    const error = new NotFoundError()

    expect(error.name).toBe('NotFoundError')
    expect(error).toBeInstanceOf(AppError)
  })
})
