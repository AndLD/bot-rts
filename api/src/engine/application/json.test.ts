import { toJson } from './json'

describe('toJson', () => {
  it('keeps plain data and drops what JSON cannot hold', () => {
    expect(toJson({ a: 1, b: undefined, c: [1, 'x'], d: new Date(0) })).toEqual({
      a: 1,
      c: [1, 'x'],
      d: '1970-01-01T00:00:00.000Z'
    })
  })

  it('turns nothing into null', () => {
    expect(toJson(undefined)).toBeNull()
  })
})
