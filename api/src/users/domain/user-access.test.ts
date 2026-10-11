import { buildUser } from '../../../tests/integration/builders'
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors'
import { assertCanUpdate, assertCanUseApi, isAdmin } from './user-access'
import { EmailNotVerifiedError, UserBannedError } from './user.errors'

describe('assertCanUseApi', () => {
  it('accepts an active user', () => {
    expect(() => assertCanUseApi(buildUser())).not.toThrow()
  })

  it('rejects a missing, banned or unverified user', () => {
    expect(() => assertCanUseApi(null)).toThrow(UnauthorizedError)
    expect(() => assertCanUseApi(buildUser({ status: 'banned' }))).toThrow(UserBannedError)
    expect(() => assertCanUseApi(buildUser({ isActive: false }))).toThrow(EmailNotVerifiedError)
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
    expect(() =>
      assertCanUpdate('owner', buildUser({ status: 'admin' }), { status: 'banned', password: 'x' })
    ).not.toThrow()
  })

  it('lets an admin change the profile of a regular user', () => {
    expect(() => assertCanUpdate('admin', regular, { name: 'Bob', subscription: 'monthly' })).not.toThrow()
  })

  it.each([{ status: 'banned' as const }, { isActive: false }, { password: 'x' }])(
    'forbids an admin from changing %p',
    (patch) => {
      expect(() => assertCanUpdate('admin', regular, patch)).toThrow(ForbiddenError)
    }
  )

  it('forbids an admin from editing admins and owners', () => {
    expect(() => assertCanUpdate('admin', buildUser({ status: 'admin' }), { name: 'Bob' })).toThrow(ForbiddenError)
    expect(() => assertCanUpdate('admin', buildUser({ status: 'owner' }), { name: 'Bob' })).toThrow(ForbiddenError)
  })

  it('forbids everyone else', () => {
    for (const status of ['user', 'unlimited', 'banned'] as const) {
      expect(() => assertCanUpdate(status, regular, { name: 'Bob' })).toThrow(ForbiddenError)
    }
  })
})
