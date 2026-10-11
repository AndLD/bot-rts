import { hasOwnerOnlyFields, parseUserPutBody } from './userUpdate'

describe('parseUserPutBody', () => {
  it('accepts whitelisted fields', () => {
    const body = { name: 'Alice', subscription: 'monthly', status: 'banned', active: true, password: 'Passw0rd!x' }

    expect(parseUserPutBody(body)).toEqual(body)
  })

  it.each([
    null,
    'text',
    [],
    {},
    { email: 'x@y.z' },
    { role: 'admin' },
    { name: 5 },
    { name: 'alice' },
    { subscription: 'gold' },
    { status: 'root' },
    { active: 'true' },
    { password: 'weak' },
    { password: 5 }
  ])('rejects %p', (body) => {
    expect(parseUserPutBody(body)).toBeUndefined()
  })
})

describe('hasOwnerOnlyFields', () => {
  it.each([{ status: 'user' }, { active: false }, { password: 'x' }])('flags %p', (body) => {
    expect(hasOwnerOnlyFields(body as never)).toBe(true)
  })

  it('does not flag name and subscription', () => {
    expect(hasOwnerOnlyFields({ name: 'A', subscription: 'free' })).toBe(false)
  })
})
