import { buildUser } from '../../../tests/integration/builders'
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors'
import { assertCanUpdate, assertCanUseApi, isAdmin } from './user-access'
import { EmailNotVerifiedError, UserBannedError } from './user.errors'

describe('assertCanUseApi', () => {
  it('accepts an existing, unbanned user with a verified email', () => {
    expect(() => assertCanUseApi(buildUser(), true)).not.toThrow()
  })

  it('rejects a missing or deleted user, a banned user and an unverified email', () => {
    expect(() => assertCanUseApi(null, true)).toThrow(UnauthorizedError)
    expect(() => assertCanUseApi(buildUser({ deletedAt: new Date() }), true)).toThrow(UnauthorizedError)
    expect(() => assertCanUseApi(buildUser({ status: 'banned' }), true)).toThrow(UserBannedError)
    expect(() => assertCanUseApi(buildUser(), false)).toThrow(EmailNotVerifiedError)
  })
})

describe('isAdmin', () => {
  it.each([
    ['owner', true],
    ['admin', true],
    ['user', false],
    ['unlimited', false],
    ['banned', false]
  ] as const)('%s -> %s', (status, expected) => {
    expect(isAdmin(status)).toBe(expected)
  })
})

describe('assertCanUpdate', () => {
  const regular = buildUser()

  it('lets an owner change anything of anyone', () => {
    expect(() => assertCanUpdate('owner', buildUser({ status: 'admin' }), { status: 'banned' })).not.toThrow()
  })

  it('lets an admin change the profile of a regular user', () => {
    expect(() => assertCanUpdate('admin', regular, { name: 'Bob', subscription: 'monthly' })).not.toThrow()
  })

  it('forbids an admin from changing the status and from editing admins and owners', () => {
    expect(() => assertCanUpdate('admin', regular, { status: 'banned' })).toThrow(ForbiddenError)
    expect(() => assertCanUpdate('admin', buildUser({ status: 'admin' }), { name: 'Bob' })).toThrow(ForbiddenError)
    expect(() => assertCanUpdate('admin', buildUser({ status: 'owner' }), { name: 'Bob' })).toThrow(ForbiddenError)
  })

  it('forbids everyone else', () => {
    for (const status of ['user', 'unlimited', 'banned'] as const) {
      expect(() => assertCanUpdate(status, regular, { name: 'Bob' })).toThrow(ForbiddenError)
    }
  })
})
