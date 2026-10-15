import { PRIVACY_POLICY_VERSION } from '../../../../lib/utils/privacy'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { UnauthorizedError } from '../../shared/domain/errors'
import { EmailNotVerifiedError, UserBannedError } from '../../users/domain/user.errors'
import { AccessTokenExpiredError } from '../domain/auth.errors'

const input = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'Passw0rd!x',
  acceptedPrivacyVersion: PRIVACY_POLICY_VERSION
}

async function setup() {
  const world = createAuthWorld()
  const tokens = await world.auth.register(input)
  const user = (await world.repositories.users.findByEmail(input.email))!
  const credential = (await world.repositories.credentials.findByUserId(user.id))!
  world.repositories.credentials.items.set(user.id, { ...credential, emailVerified: true })
  return { ...world, tokens, user }
}

describe('AuthService.authenticate', () => {
  it('returns the user and the identity of a valid access token', async () => {
    const { authService, tokens, user } = await setup()

    const principal = await authService.authenticate(tokens.accessToken)

    expect(principal.user).toEqual(user)
    expect(principal.identity).toMatchObject({
      provider: 'local',
      subject: user.id,
      email: user.email,
      emailVerified: true
    })
    expect(principal.identity.sessionId).toEqual(expect.any(String))
  })

  it('takes roles and bans from the store, not from the token', async () => {
    const { authService, tokens, user, repositories } = await setup()

    repositories.users.items.set(user.id, { ...user, status: 'owner' })
    expect((await authService.authenticate(tokens.accessToken)).user.status).toBe('owner')

    repositories.users.items.set(user.id, { ...user, status: 'banned' })
    await expect(authService.authenticate(tokens.accessToken)).rejects.toThrow(UserBannedError)
  })

  it('rejects an unverified email, a deleted user and a revoked session', async () => {
    const { authService, auth, tokens, user, repositories } = await setup()
    const credential = repositories.credentials.items.get(user.id)!

    repositories.credentials.items.set(user.id, { ...credential, emailVerified: false })
    await expect(authService.authenticate(tokens.accessToken)).rejects.toThrow(EmailNotVerifiedError)
    repositories.credentials.items.set(user.id, credential)

    repositories.users.items.set(user.id, { ...user, deletedAt: new Date() })
    await expect(authService.authenticate(tokens.accessToken)).rejects.toThrow(UnauthorizedError)
    repositories.users.items.set(user.id, user)

    await auth.logout(tokens.refreshToken)
    await expect(authService.authenticate(tokens.accessToken)).rejects.toThrow(UnauthorizedError)
  })

  it('rejects an expired or malformed token', async () => {
    const { authService, accessTokens, tokens } = await setup()
    accessTokens.expired.add(tokens.accessToken)

    await expect(authService.authenticate(tokens.accessToken)).rejects.toThrow(AccessTokenExpiredError)
    await expect(authService.authenticate('garbage')).rejects.toThrow(UnauthorizedError)
  })
})

describe('AuthService.authenticate in a view of a player', () => {
  async function view(adminStatus: 'owner' | 'admin' | 'moderator', playerStatus: 'user' | 'admin' = 'user') {
    const world = await setup()
    const { repositories, user: admin, accessTokens, clock } = world
    const player = {
      ...admin,
      id: '7d1b6c5a-3a4e-4c1d-9d52-0b3f4f6d8e11',
      email: 'bob@example.com',
      status: playerStatus
    }

    repositories.users.items.set(admin.id, { ...admin, status: adminStatus })
    repositories.users.items.set(player.id, player)
    await repositories.sessions.add({
      id: 'view-session',
      userId: admin.id,
      refreshTokenHash: 'view-as:view-session',
      createdAt: clock.now(),
      lastUsedAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + 60_000),
      revokedAt: null,
      userAgent: null,
      viewAs: { userId: player.id, reason: 'support' }
    })

    return { ...world, admin, player, token: accessTokens.sign({ userId: admin.id, sessionId: 'view-session' }) }
  }

  it('answers as the player and names the admin behind the view', async () => {
    const { authService, token, player, admin } = await view('admin')

    const principal = await authService.authenticate(token)

    expect(principal.user.id).toBe(player.id)
    expect(principal.viewAs).toMatchObject({ adminId: admin.id, adminStatus: 'admin', reason: 'support' })
  })

  it.each([
    ['an admin who lost the permission', 'moderator', 'user'],
    ['a player of the same rank', 'admin', 'admin']
  ] as const)('ends the view for %s', async (_name, adminStatus, playerStatus) => {
    const { authService, token } = await view(adminStatus, playerStatus)

    await expect(authService.authenticate(token)).rejects.toThrow(UnauthorizedError)
  })

  it('ends the view when the player no longer exists', async () => {
    const { authService, token, player, repositories } = await view('owner')
    repositories.users.items.delete(player.id)

    await expect(authService.authenticate(token)).rejects.toThrow(UnauthorizedError)
  })
})
