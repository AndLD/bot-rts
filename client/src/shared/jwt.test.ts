import { makeJwt } from '../../tests/jwt'
import { isJwtExpired } from './jwt'

describe('isJwtExpired', () => {
  it('is false before the expiry time', () => {
    expect(isJwtExpired(makeJwt(60))).toBe(false)
  })

  it('is true after the expiry time', () => {
    expect(isJwtExpired(makeJwt(-1))).toBe(true)
  })
})
