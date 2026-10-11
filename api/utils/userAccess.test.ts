import { makeUser } from '../tests/helpers'
import { errors } from './constants'
import { getAccessDenial, toUserState } from './userAccess'

describe('getAccessDenial', () => {
  it('rejects a missing user', () => {
    expect(getAccessDenial(null)).toBe(errors.JWT_INVALID)
  })

  it('rejects a banned user', () => {
    expect(getAccessDenial(makeUser({ status: 'banned' }))).toBe(errors.USER_BANNED)
  })

  it('rejects an unverified user', () => {
    expect(getAccessDenial(makeUser({ active: false }))).toBe(errors.EMAIL_NOT_VERIFIED)
  })

  it('allows an active user', () => {
    expect(getAccessDenial(makeUser())).toBeUndefined()
  })
})

describe('toUserState', () => {
  it('drops the password and keywords', () => {
    const state = toUserState(makeUser({ updatedAt: 2 }))

    expect(state).toEqual({
      _id: '64b7f0f2a1b2c3d4e5f60718',
      name: 'Alice',
      email: 'alice@example.com',
      status: 'user',
      active: true,
      subscription: 'free',
      createdAt: 1,
      updatedAt: 2
    })
  })
})
