import { parseUserIdFromEmailVerificationToken, parseUserIdFromSessionToken } from './jwtPayload'

const id = '64b7f0f2a1b2c3d4e5f60718'

describe('parseUserIdFromSessionToken', () => {
  it('returns the user id', () => {
    expect(parseUserIdFromSessionToken({ user: { _id: id, status: 'admin' } })).toBe(id)
  })

  it.each([
    undefined,
    null,
    'text',
    5,
    {},
    { user: null },
    { user: 'x' },
    { user: {} },
    { user: { _id: 5 } },
    { user: { _id: 'bad' } }
  ])('rejects %p', (payload) => {
    expect(parseUserIdFromSessionToken(payload)).toBeUndefined()
  })
})

describe('parseUserIdFromEmailVerificationToken', () => {
  it('reads user.id', () => {
    expect(parseUserIdFromEmailVerificationToken({ user: { id } })).toBe(id)
  })

  it('does not accept the session token shape', () => {
    expect(parseUserIdFromEmailVerificationToken({ user: { _id: id } })).toBeUndefined()
  })
})
