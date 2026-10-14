import { Socket } from 'socket.io'
import { buildUser } from '../../../tests/integration/builders'
import { createAdminSocketGuard, SOCKET_FORBIDDEN, SOCKET_TWO_FACTOR_REQUIRED } from './admin-socket.guard'

const run = async (principal: unknown, isVerified: boolean) => {
  const guard = createAdminSocketGuard('dashboard.read', { isSessionVerified: async () => isVerified })
  const next = jest.fn()
  await guard({ principal } as unknown as Socket, next)

  return next.mock.calls[0]
}

const principal = (status: 'analyst' | 'user', extra = {}) => ({
  user: buildUser({ status }),
  identity: { sessionId: 's1' },
  ...extra
})

describe('createAdminSocketGuard', () => {
  it('lets a verified admin with the permission in', async () => {
    expect(await run(principal('analyst'), true)).toEqual([])
  })

  it('refuses a missing principal, a player, an API key and an unverified session', async () => {
    expect((await run(undefined, true))[0].message).toBe('Unauthorized')
    expect((await run(principal('user'), true))[0].message).toBe(SOCKET_FORBIDDEN)
    expect((await run(principal('analyst', { apiKey: { id: 'k' } }), true))[0].message).toBe(SOCKET_FORBIDDEN)
    expect((await run(principal('analyst'), false))[0].message).toBe(SOCKET_TWO_FACTOR_REQUIRED)
  })
})
