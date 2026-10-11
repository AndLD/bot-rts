import { parseUserPatch } from './user-update'

describe('parseUserPatch', () => {
  it('accepts whitelisted fields and maps `active` to `isActive`', () => {
    expect(
      parseUserPatch({ name: 'Alice', subscription: 'monthly', status: 'banned', active: true, password: 'Passw0rd!x' })
    ).toEqual({ name: 'Alice', subscription: 'monthly', status: 'banned', isActive: true, password: 'Passw0rd!x' })
  })

  it('passes a partial body through', () => {
    expect(parseUserPatch({ name: 'Alice' })).toEqual({ name: 'Alice' })
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
    expect(parseUserPatch(body)).toBeUndefined()
  })
})
