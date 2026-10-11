import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { ForbiddenError } from '../../shared/domain/errors'
import { RolesGuard } from './roles.guard'
import { RequiredRole } from './roles.decorator'

function contextFor(status: UserStatus): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ principal: { user: { status } } }) })
  } as unknown as ExecutionContext
}

function guardRequiring(role: RequiredRole | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(role) } as unknown as Reflector
  return new RolesGuard(reflector)
}

describe('RolesGuard', () => {
  it('lets everyone through a route without a required role', () => {
    expect(guardRequiring(undefined).canActivate(contextFor('user'))).toBe(true)
  })

  it.each([
    ['owner', true],
    ['admin', true],
    ['user', false],
    ['banned', false]
  ] as const)('admin routes: %s -> %s', (status, allowed) => {
    const guard = guardRequiring('admin')

    if (allowed) {
      expect(guard.canActivate(contextFor(status))).toBe(true)
    } else {
      expect(() => guard.canActivate(contextFor(status))).toThrow(ForbiddenError)
    }
  })

  it('lets only the owner into owner routes', () => {
    const guard = guardRequiring('owner')

    expect(guard.canActivate(contextFor('owner'))).toBe(true)
    expect(() => guard.canActivate(contextFor('admin'))).toThrow(ForbiddenError)
  })
})
