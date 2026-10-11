import { isValidId } from './ids'

describe('isValidId', () => {
  it('accepts UUIDs', () => {
    expect(isValidId('0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e')).toBe(true)
    expect(isValidId('0B7B4B0E-7D3A-4F0E-9A52-0F0B9A1C2D3E')).toBe(true)
  })

  it.each(['', 'abc', '64b7f0f2a1b2c3d4e5f60718', '0b7b4b0e7d3a4f0e9a520f0b9a1c2d3e', 5, null, undefined, {}])(
    'rejects %p',
    (value) => {
      expect(isValidId(value)).toBe(false)
    }
  )
})
