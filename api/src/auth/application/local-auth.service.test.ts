import { PRIVACY_POLICY_VERSION } from '../../../../lib/utils/privacy'
import { createAuthWorld } from '../../../tests/fakes/auth'
import { buildUser } from '../../../tests/integration/builders'
import { UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import {
  CredentialsInvalidError,
  EmailAlreadyExistsError,
  PrivacyNotAcceptedError,
  EmailNotVerifiedError,
  UserBannedError
} from '../../users/domain/user.errors'
import { InvalidTokenError, WrongPasswordError } from '../domain/auth.errors'

const input = {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'Passw0rd!x',
  acceptedPrivacyVersion: PRIVACY_POLICY_VERSION,
  userAgent: 'jest'
}
const HOUR = 3600 * 1000

async function setup() {
  const world = createAuthWorld()
  const tokens = await world.auth.register(input)
  const user = (await world.repositories.users.findByEmail('alice@example.com'))!
  return { ...world, tokens, user }
}

// Marks the email as verified without going through the link
async function verified() {
  const world = await setup()
  const credential = (await world.repositories.credentials.findByUserId(world.user.id))!
  world.repositories.credentials.items.set(world.user.id, { ...credential, emailVerified: true })
  return world
}

describe('register', () => {
  it('creates the user, the local identity, the credential and a session, and sends the verification mail', async () => {
    const { user, repositories, tokens, mailer } = await setup()

    expect(user).toMatchObject({ name: 'Alice', email: 'alice@example.com', status: 'user', deletedAt: null })
    expect(repositories.identities.items).toEqual([
      expect.objectContaining({ provider: 'local', subject: user.id, userId: user.id })
    ])
    expect(repositories.credentials.items.get(user.id)).toMatchObject({
      passwordHash: 'hashed:Passw0rd!x',
      emailVerified: false
    })
    expect([...repositories.sessions.items.values()]).toEqual([
      expect.objectContaining({
        userId: user.id,
        userAgent: 'jest',
        revokedAt: null,
        refreshTokenHash: 'h(' + tokens.refreshToken + ')'
      })
    ])
    expect(tokens.accessToken).toMatch(/^access\./)
    expect(mailer.last('verification')).toMatchObject({ to: 'alice@example.com' })
  })

  it('stores the version of the privacy policy that was accepted, and when', async () => {
    const { user } = await setup()

    expect(user.privacyAcceptedVersion).toBe(PRIVACY_POLICY_VERSION)
    expect(user.privacyAcceptedAt).toBeInstanceOf(Date)
  })

  it('refuses a sign-up that accepted another version of the policy, and creates nothing', async () => {
    const world = createAuthWorld()

    await expect(world.auth.register({ ...input, acceptedPrivacyVersion: '1999-01-01' })).rejects.toThrow(
      PrivacyNotAcceptedError
    )
    expect(world.repositories.users.items.size).toBe(0)
  })

  it('normalises the email and rejects a taken one', async () => {
    const { auth, repositories } = await setup()

    await expect(auth.register({ ...input, email: '  ALICE@Example.com ' })).rejects.toThrow(EmailAlreadyExistsError)
    expect(repositories.users.items.size).toBe(1)
  })

  it('does not fail when the mail server does', async () => {
    const world = createAuthWorld()
    world.mailer.fail = true

    await expect(world.auth.register(input)).resolves.toBeDefined()
    await new Promise((resolve) => setImmediate(resolve))
    expect(world.logger.error).toHaveBeenCalled()
  })
})

describe('login', () => {
  it('starts a session for a verified user', async () => {
    const { auth, repositories, user } = await verified()

    const tokens = await auth.login({ email: ' Alice@example.com', password: input.password })

    expect(tokens.accessToken).toMatch(/^access\./)
    expect(repositories.sessions.items.size).toBe(2)
    expect([...repositories.sessions.items.values()].every((session) => session.userId === user.id)).toBe(true)
  })

  it('answers the same for an unknown email and a wrong password, and for a deleted account', async () => {
    const { auth, repositories, user } = await verified()

    await expect(auth.login({ email: 'nobody@example.com', password: input.password })).rejects.toThrow(
      CredentialsInvalidError
    )
    await expect(auth.login({ email: 'alice@example.com', password: 'Wr0ng!pass' })).rejects.toThrow(
      CredentialsInvalidError
    )

    repositories.users.items.set(user.id, { ...user, deletedAt: new Date() })
    await expect(auth.login({ email: 'alice@example.com', password: input.password })).rejects.toThrow(
      CredentialsInvalidError
    )
  })

  it('rejects unverified and banned users after the password matched', async () => {
    const { auth, repositories, user } = await setup()

    await expect(auth.login(input)).rejects.toThrow(EmailNotVerifiedError)
    await expect(auth.login({ ...input, password: 'bad' })).rejects.toThrow(CredentialsInvalidError)

    repositories.users.items.set(user.id, { ...user, status: 'banned' })
    await expect(auth.login(input)).rejects.toThrow(UserBannedError)
  })
})

describe('login attempts', () => {
  it('writes down every attempt with the address, the user agent and the outcome', async () => {
    const { auth, repositories, user, attempts } = await setup()
    await auth
      .login({ email: 'Nobody@Example.com', password: 'x', ip: '1.1.1.1', userAgent: 'curl' })
      .catch(() => undefined)
    await auth.login({ ...input, ip: '2.2.2.2' }).catch(() => undefined)
    const credential = (await repositories.credentials.findByUserId(user.id))!
    repositories.credentials.items.set(user.id, { ...credential, emailVerified: true })
    await auth.login({ ...input, ip: '3.3.3.3' })
    repositories.users.items.set(user.id, { ...user, status: 'banned' })
    await auth.login({ ...input, ip: '4.4.4.4' }).catch(() => undefined)

    expect(
      attempts.items.map(({ email, userId, ip, userAgent, outcome }) => [email, userId, ip, userAgent, outcome])
    ).toEqual([
      ['nobody@example.com', null, '1.1.1.1', 'curl', 'bad_credentials'],
      ['alice@example.com', null, '2.2.2.2', 'jest', 'unverified'],
      ['alice@example.com', user.id, '3.3.3.3', 'jest', 'success'],
      ['alice@example.com', null, '4.4.4.4', 'jest', 'banned']
    ])
  })

  it('records an unexpected failure as an error, and an attempt without an address as null', async () => {
    const { auth, repositories, attempts } = await setup()
    jest.spyOn(repositories.users, 'findByEmail').mockRejectedValueOnce(new Error('database down'))

    await expect(auth.login({ email: 'a@b.c', password: 'x' })).rejects.toThrow('database down')

    expect(attempts.items[0]).toMatchObject({ outcome: 'error', ip: null, userAgent: null })
  })

  it('does not change the answer when the attempt cannot be written, and logs it', async () => {
    const { auth, attempts, logger } = await verified()
    attempts.isFailing = true

    await expect(auth.login(input)).resolves.toMatchObject({ accessToken: expect.any(String) })
    await expect(auth.login({ ...input, password: 'bad' })).rejects.toThrow(CredentialsInvalidError)
    expect(logger.error).toHaveBeenCalledTimes(2)
  })
})

describe('refresh', () => {
  it('rotates the refresh token and keeps the session', async () => {
    const { auth, repositories, tokens, clock } = await verified()
    clock.current = new Date(clock.current.getTime() + HOUR)

    const next = await auth.refresh(tokens.refreshToken)

    expect(next.refreshToken).not.toBe(tokens.refreshToken)
    expect(repositories.sessions.items.size).toBe(1)
    const [session] = repositories.sessions.items.values()
    expect(session.lastUsedAt).toEqual(clock.current)
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)
    await expect(auth.refresh(next.refreshToken)).resolves.toBeDefined()
  })

  it('rejects unknown, revoked and expired sessions', async () => {
    const { auth, repositories, tokens, clock, policy } = await verified()
    const [session] = repositories.sessions.items.values()

    await expect(auth.refresh('nope')).rejects.toThrow(UnauthorizedError)

    clock.current = new Date(clock.current.getTime() + policy.sessionTtlMs + 1)
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)

    clock.current = new Date(session.createdAt.getTime())
    repositories.sessions.items.set(session.id, { ...session, revokedAt: clock.current })
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)
  })

  it('rejects banned and unverified users and ends no session by itself', async () => {
    const { auth, repositories, tokens, user } = await verified()

    repositories.users.items.set(user.id, { ...user, status: 'banned' })
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UserBannedError)

    repositories.users.items.set(user.id, user)
    repositories.credentials.items.set(user.id, {
      ...repositories.credentials.items.get(user.id)!,
      emailVerified: false
    })
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(EmailNotVerifiedError)
  })

  it('treats a session whose credential vanished as unverified', async () => {
    const { auth, repositories, tokens, user } = await verified()
    repositories.credentials.items.delete(user.id)

    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(EmailNotVerifiedError)
  })
})

describe('logout', () => {
  it('revokes the session once and ignores unknown tokens', async () => {
    const { auth, repositories, tokens, clock } = await setup()

    await auth.logout(tokens.refreshToken)
    const [session] = repositories.sessions.items.values()
    expect(session.revokedAt).toEqual(clock.current)

    clock.current = new Date(clock.current.getTime() + HOUR)
    await auth.logout(tokens.refreshToken)
    await auth.logout('unknown')
    expect([...repositories.sessions.items.values()][0].revokedAt).toEqual(session.revokedAt)
  })
})

describe('email verification', () => {
  it('verifies the email with the emailed token, once', async () => {
    const { auth, mailer, repositories, user } = await setup()
    const { token } = mailer.last('verification')!

    await auth.verifyEmail(token)

    expect(repositories.credentials.items.get(user.id)?.emailVerified).toBe(true)
    await expect(auth.verifyEmail(token)).rejects.toThrow(InvalidTokenError)
  })

  it('rejects unknown, expired and foreign tokens', async () => {
    const { auth, mailer, clock } = await setup()
    const { token } = mailer.last('verification')!

    await expect(auth.verifyEmail('unknown')).rejects.toThrow(InvalidTokenError)

    await auth.requestPasswordReset('alice@example.com')
    await expect(auth.verifyEmail(mailer.last('password-reset')!.token)).rejects.toThrow(InvalidTokenError)

    clock.current = new Date(clock.current.getTime() + 25 * HOUR)
    await expect(auth.verifyEmail(token)).rejects.toThrow(InvalidTokenError)
  })

  it('resends a fresh link to unverified users only, without revealing who is registered', async () => {
    const { auth, mailer } = await setup()
    const first = mailer.last('verification')!.token

    await auth.resendVerification('Alice@example.com')
    const second = mailer.last('verification')!.token
    await auth.resendVerification('nobody@example.com')

    expect(second).not.toBe(first)
    expect(mailer.sent.filter((message) => message.kind === 'verification')).toHaveLength(2)
    await expect(auth.verifyEmail(first)).rejects.toThrow(InvalidTokenError)
    await auth.verifyEmail(second)

    await auth.resendVerification('alice@example.com')
    expect(mailer.sent.filter((message) => message.kind === 'verification')).toHaveLength(2)
  })
})

describe('password reset', () => {
  it('sets a new password, verifies the email and signs every device out', async () => {
    const { auth, mailer, repositories, tokens, user } = await setup()

    await auth.requestPasswordReset(' ALICE@example.com')
    await auth.resetPassword(mailer.last('password-reset')!.token, 'NewPassw0rd!')

    expect(repositories.credentials.items.get(user.id)).toMatchObject({
      passwordHash: 'hashed:NewPassw0rd!',
      emailVerified: true
    })
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)
    await expect(auth.login({ email: 'alice@example.com', password: 'NewPassw0rd!' })).resolves.toBeDefined()
  })

  it('does not reveal unknown addresses, and a link works once', async () => {
    const { auth, mailer } = await setup()

    await auth.requestPasswordReset('nobody@example.com')
    expect(mailer.last('password-reset')).toBeUndefined()

    await auth.requestPasswordReset('alice@example.com')
    const { token } = mailer.last('password-reset')!
    await auth.resetPassword(token, 'NewPassw0rd!')
    await expect(auth.resetPassword(token, 'Another1!x')).rejects.toThrow(InvalidTokenError)
  })

  it('does not send mail for a deleted account', async () => {
    const { auth, mailer, repositories, user } = await setup()
    repositories.users.items.set(user.id, { ...user, deletedAt: new Date() })

    await auth.requestPasswordReset('alice@example.com')

    expect(mailer.last('password-reset')).toBeUndefined()
  })

  it('refuses a token whose credential is gone', async () => {
    const { auth, mailer, repositories, user } = await setup()
    await auth.requestPasswordReset('alice@example.com')
    repositories.credentials.items.delete(user.id)

    await expect(auth.resetPassword(mailer.last('password-reset')!.token, 'NewPassw0rd!')).rejects.toThrow(
      InvalidTokenError
    )
  })
})

describe('change password', () => {
  it('needs the current password and keeps only the current session', async () => {
    const { auth, repositories, user, tokens } = await verified()
    const other = await auth.login({ email: 'alice@example.com', password: input.password })
    const current = [...repositories.sessions.items.values()][0]

    await expect(auth.changePassword(user.id, current.id, 'bad', 'NewPassw0rd!')).rejects.toThrow(WrongPasswordError)
    await auth.changePassword(user.id, current.id, input.password, 'NewPassw0rd!')

    expect(repositories.credentials.items.get(user.id)?.passwordHash).toBe('hashed:NewPassw0rd!')
    await expect(auth.refresh(tokens.refreshToken)).resolves.toBeDefined()
    await expect(auth.refresh(other.refreshToken)).rejects.toThrow(UnauthorizedError)
  })

  it('signs every session out when called without a current one', async () => {
    const { auth, user, tokens } = await verified()

    await auth.changePassword(user.id, undefined, input.password, 'NewPassw0rd!')

    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)
  })

  it('fails for an account without credentials', async () => {
    const world = createAuthWorld()

    await expect(world.auth.changePassword('missing', undefined, 'a', 'b')).rejects.toThrow(InvalidTokenError)
  })
})

describe('email change', () => {
  it('moves the account to the new address after the new mailbox confirmed it', async () => {
    const { auth, mailer, repositories, user, clock } = await verified()

    await auth.requestEmailChange(user.id, input.password, ' New@Example.com ')
    const message = mailer.last('email-change')!
    expect(message.to).toBe('new@example.com')

    await auth.confirmEmailChange(message.token)

    expect(repositories.users.items.get(user.id)).toMatchObject({ email: 'new@example.com', updatedAt: clock.current })
    await expect(auth.confirmEmailChange(message.token)).rejects.toThrow(InvalidTokenError)
  })

  it('checks the password and refuses the current and the taken address', async () => {
    const { auth, repositories, user } = await verified()
    repositories.users.items.set('other', buildUser({ id: 'other', email: 'taken@example.com' }))

    await expect(auth.requestEmailChange(user.id, 'bad', 'new@example.com')).rejects.toThrow(WrongPasswordError)
    await expect(auth.requestEmailChange(user.id, input.password, 'alice@example.com')).rejects.toThrow(ValidationError)
    await expect(auth.requestEmailChange(user.id, input.password, 'taken@example.com')).rejects.toThrow(
      EmailAlreadyExistsError
    )
  })

  it('re-checks that the address is still free at confirmation', async () => {
    const { auth, mailer, repositories, user } = await verified()
    await auth.requestEmailChange(user.id, input.password, 'new@example.com')
    repositories.users.items.set('other', buildUser({ id: 'other', email: 'new@example.com' }))

    await expect(auth.confirmEmailChange(mailer.last('email-change')!.token)).rejects.toThrow(EmailAlreadyExistsError)
  })

  it('rejects a link of a deleted user', async () => {
    const { auth, mailer, repositories, user } = await verified()
    await auth.requestEmailChange(user.id, input.password, 'new@example.com')
    repositories.users.items.delete(user.id)

    await expect(auth.confirmEmailChange(mailer.last('email-change')!.token)).rejects.toThrow(InvalidTokenError)
  })

  it('rejects a link without a target address', async () => {
    const { auth, mailer, repositories, user } = await verified()
    await auth.requestEmailChange(user.id, input.password, 'new@example.com')
    const token = [...repositories.authTokens.items.values()].find((t) => t.kind === 'email_change')!
    repositories.authTokens.items.set(token.id, { ...token, newEmail: null })

    await expect(auth.confirmEmailChange(mailer.last('email-change')!.token)).rejects.toThrow(InvalidTokenError)
  })
})

describe('account deletion', () => {
  it('erases personal data and all logins after the emailed confirmation', async () => {
    const { auth, mailer, repositories, user, clock, tokens } = await verified()

    await expect(auth.requestAccountDeletion(user.id, 'bad')).rejects.toThrow(WrongPasswordError)
    await auth.requestAccountDeletion(user.id, input.password)
    const message = mailer.last('account-deletion')!
    expect(message.to).toBe('alice@example.com')

    await auth.confirmAccountDeletion(message.token)

    expect(repositories.users.items.get(user.id)).toMatchObject({
      name: 'Deleted player',
      email: `deleted-${user.id}@deleted.invalid`,
      deletedAt: clock.current
    })
    expect(repositories.credentials.items.size).toBe(0)
    expect(repositories.identities.items).toHaveLength(0)
    expect(repositories.sessions.items.size).toBe(0)
    expect(repositories.authTokens.items.size).toBe(0)
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedError)
    await expect(auth.login(input)).rejects.toThrow(CredentialsInvalidError)
  })

  it('rejects a link of a user that no longer exists', async () => {
    const { auth, mailer, repositories, user } = await verified()
    await auth.requestAccountDeletion(user.id, input.password)
    repositories.users.items.delete(user.id)

    await expect(auth.confirmAccountDeletion(mailer.last('account-deletion')!.token)).rejects.toThrow(InvalidTokenError)
  })
})
