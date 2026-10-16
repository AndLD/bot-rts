import { LogStoreUnavailableError } from './log-store.errors'

describe('LogStoreUnavailableError', () => {
  it('is a 503 with its own code, and says plainly that the store cannot be reached', () => {
    const error = new LogStoreUnavailableError()

    expect([error.statusCode, error.code, error.message]).toEqual([
      503,
      'LOG_STORE_UNAVAILABLE',
      'The log store cannot be reached'
    ])
    expect(new LogStoreUnavailableError('slow').message).toBe('slow')
  })
})
