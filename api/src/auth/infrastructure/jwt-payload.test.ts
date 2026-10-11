import { parseUserIdFromEmailVerificationToken, parseUserIdFromSessionToken } from './jwt-payload'

const id = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'

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
