import { isValidId } from './objectId'

describe('isValidId', () => {
  it('accepts 24-char hex strings', () => {
    expect(isValidId('64b7f0f2a1b2c3d4e5f60718')).toBe(true)
  })

  it.each(['', 'abc', '64b7f0f2a1b2c3d4e5f6071', 'zzzzzzzzzzzzzzzzzzzzzzzz', '123456789012', 5, null, undefined, {}])(
    'rejects %p',
    (value) => {
      expect(isValidId(value)).toBe(false)
    }
  )
})
