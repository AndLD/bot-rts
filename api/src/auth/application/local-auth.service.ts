import { PRIVACY_POLICY_VERSION } from '../../../../lib/utils/privacy'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { UnauthorizedError, ValidationError } from '../../shared/domain/errors'
import { Repositories, UnitOfWork } from '../../persistence/application/unit-of-work'
import { assertCanUseApi } from '../../users/domain/user-access'
import { User } from '../../users/domain/user.entity'
import {
  CredentialsInvalidError,
  EmailAlreadyExistsError,
  EmailNotVerifiedError,
  PrivacyNotAcceptedError,
  UserBannedError
} from '../../users/domain/user.errors'
import { eraseAccount } from './account-erasure'
import { AuthPolicy } from '../domain/auth-policy'
import { AuthTokenKind, isAuthTokenUsable } from '../domain/auth-token'
import { InvalidTokenError, WrongPasswordError } from '../domain/auth.errors'
import { LOCAL_PROVIDER } from '../domain/identity'
import { LocalCredential } from '../domain/local-credential'
import { isSessionActive } from '../domain/session'
import { CredentialAuthService, LoginInput, RegisterInput, SessionTokens } from './credential-auth.service'
import { LoginOutcome } from '../domain/login-attempt'
import { AccessTokenService, AuthMailer, LoginAttemptLog, PasswordHasher, SecretGenerator } from './ports'

export interface LocalAuthDependencies {
  unitOfWork: UnitOfWork
  hasher: PasswordHasher
  secrets: SecretGenerator
  accessTokens: AccessTokenService
  mailer: AuthMailer
  ids: IdGenerator
  clock: Clock
  policy: AuthPolicy
  logger: Logger
  attempts: LoginAttemptLog
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function outcomeOf(error: unknown): LoginOutcome {
  if (error instanceof CredentialsInvalidError) {
    return 'bad_credentials'
  }
  if (error instanceof UserBannedError) {
    return 'banned'
  }

  return error instanceof EmailNotVerifiedError ? 'unverified' : 'error'
}

// The custom identity provider: email + password accounts, sessions with rotating refresh tokens and the emailed
// single-use links of design §5.1
export class LocalAuthService implements CredentialAuthService {
  // Compared against when the email is unknown, so a login takes the same time either way
  private dummyHash: Promise<string> | undefined

  constructor(private readonly deps: LocalAuthDependencies) {}

  async register({ name, email, password, acceptedPrivacyVersion, userAgent }: RegisterInput): Promise<SessionTokens> {
    if (acceptedPrivacyVersion !== PRIVACY_POLICY_VERSION) {
      throw new PrivacyNotAcceptedError()
    }

    const address = normalizeEmail(email)
    const passwordHash = await this.deps.hasher.hash(password)

    const { tokens, verificationSecret } = await this.deps.unitOfWork.run(async (repositories) => {
      if (await repositories.users.findByEmail(address)) {
        throw new EmailAlreadyExistsError()
      }

      const now = this.deps.clock.now()
      const user: User = {
        id: this.deps.ids.next(),
        name,
        email: address,
        status: 'user',
        subscription: 'free',
        createdAt: now,
        updatedAt: null,
        privacyAcceptedVersion: acceptedPrivacyVersion,
        privacyAcceptedAt: now,
        deletedAt: null
      }
      await repositories.users.add(user)
      await repositories.identities.add({
        id: this.deps.ids.next(),
        provider: LOCAL_PROVIDER,
        subject: user.id,
        userId: user.id,
        createdAt: now
      })
      await repositories.credentials.add({ userId: user.id, passwordHash, emailVerified: false, updatedAt: now })

      return {
        verificationSecret: await this.createToken(
          repositories,
          user.id,
          'email_verification',
          this.deps.policy.emailVerificationTtlMs
        ),
        tokens: await this.startSession(repositories, user.id, userAgent)
      }
    })

    this.send(this.deps.mailer.sendEmailVerification(address, verificationSecret))

    return tokens
  }

  async login(input: LoginInput): Promise<SessionTokens> {
    try {
      const { tokens, userId } = await this.authenticate(input)
      await this.record(input, 'success', userId)

      return tokens
    } catch (error) {
      await this.record(input, outcomeOf(error), null)
      throw error
    }
  }

  private authenticate({ email, password, userAgent }: LoginInput): Promise<{ tokens: SessionTokens; userId: string }> {
    return this.deps.unitOfWork.run(async (repositories) => {
      const user = await repositories.users.findByEmail(normalizeEmail(email))
      const credential = user && !user.deletedAt ? await repositories.credentials.findByUserId(user.id) : null
      const passwordMatches = await this.deps.hasher.verify(
        password,
        credential?.passwordHash ?? (await this.getDummyHash())
      )

      if (!user || !credential || !passwordMatches) {
        throw new CredentialsInvalidError()
      }
      assertCanUseApi(user, credential.emailVerified)

      return { tokens: await this.startSession(repositories, user.id, userAgent), userId: user.id }
    })
  }

  // Writing the attempt down must never change the answer to the one who tried
  private async record({ email, ip, userAgent }: LoginInput, outcome: LoginOutcome, userId: string | null) {
    try {
      await this.deps.attempts.record({
        id: this.deps.ids.next(),
        at: this.deps.clock.now(),
        email: normalizeEmail(email),
        userId,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        outcome
      })
    } catch (error) {
      this.deps.logger.error(error)
    }
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    return this.deps.unitOfWork.run(async (repositories) => {
      const now = this.deps.clock.now()
      const session = await repositories.sessions.findByRefreshTokenHash(this.deps.secrets.hash(refreshToken))

      if (!session || !isSessionActive(session, now)) {
        throw new UnauthorizedError('The session has ended')
      }

      const [user, credential] = await Promise.all([
        repositories.users.findById(session.userId),
        repositories.credentials.findByUserId(session.userId)
      ])
      assertCanUseApi(user, credential?.emailVerified ?? false)

      // The refresh token rotates: the one that was just used stops working
      const nextRefreshToken = this.deps.secrets.generate()
      await repositories.sessions.update({
        ...session,
        refreshTokenHash: this.deps.secrets.hash(nextRefreshToken),
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + this.deps.policy.sessionTtlMs)
      })

      return {
        accessToken: this.deps.accessTokens.sign({ userId: user.id, sessionId: session.id }),
        refreshToken: nextRefreshToken
      }
    })
  }

  async logout(refreshToken: string): Promise<void> {
    await this.deps.unitOfWork.run(async ({ sessions }) => {
      const session = await sessions.findByRefreshTokenHash(this.deps.secrets.hash(refreshToken))

      if (session && !session.revokedAt) {
        await sessions.update({ ...session, revokedAt: this.deps.clock.now() })
      }
    })
  }

  async verifyEmail(token: string): Promise<void> {
    await this.deps.unitOfWork.run(async (repositories) => {
      const { userId } = await this.consumeToken(repositories, 'email_verification', token)
      await this.markEmailVerified(repositories, userId)
    })
  }

  async resendVerification(email: string): Promise<void> {
    const address = normalizeEmail(email)

    const secret = await this.deps.unitOfWork.run(async (repositories) => {
      const user = await repositories.users.findByEmail(address)
      const credential = user && !user.deletedAt ? await repositories.credentials.findByUserId(user.id) : null

      // The answer never reveals whether the address is registered
      return user && credential && !credential.emailVerified
        ? this.createToken(repositories, user.id, 'email_verification', this.deps.policy.emailVerificationTtlMs)
        : null
    })

    if (secret) {
      this.send(this.deps.mailer.sendEmailVerification(address, secret))
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const address = normalizeEmail(email)

    const secret = await this.deps.unitOfWork.run(async (repositories) => {
      const user = await repositories.users.findByEmail(address)
      const credential = user && !user.deletedAt ? await repositories.credentials.findByUserId(user.id) : null

      return user && credential
        ? this.createToken(repositories, user.id, 'password_reset', this.deps.policy.passwordResetTtlMs)
        : null
    })

    if (secret) {
      this.send(this.deps.mailer.sendPasswordReset(address, secret))
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordHash = await this.deps.hasher.hash(newPassword)

    await this.deps.unitOfWork.run(async (repositories) => {
      const { userId } = await this.consumeToken(repositories, 'password_reset', token)
      const credential = await this.requireCredential(repositories, userId)
      const now = this.deps.clock.now()

      // Following the link proves control of the mailbox, so the email counts as verified
      await repositories.credentials.update({ ...credential, passwordHash, emailVerified: true, updatedAt: now })
      await repositories.sessions.revokeAllOfUser(userId, now)
    })
  }

  async changePassword(
    userId: string,
    sessionId: string | undefined,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const passwordHash = await this.deps.hasher.hash(newPassword)

    await this.deps.unitOfWork.run(async (repositories) => {
      const credential = await this.requireMatchingPassword(repositories, userId, currentPassword)
      const now = this.deps.clock.now()

      await repositories.credentials.update({ ...credential, passwordHash, updatedAt: now })
      // The other devices are signed out; this one stays
      await repositories.sessions.revokeAllOfUser(userId, now, sessionId)
    })
  }

  async requestEmailChange(userId: string, password: string, newEmail: string): Promise<void> {
    const address = normalizeEmail(newEmail)

    const secret = await this.deps.unitOfWork.run(async (repositories) => {
      await this.requireMatchingPassword(repositories, userId, password)

      if ((await repositories.users.findById(userId))?.email === address) {
        throw new ValidationError('This is already your address')
      }
      if (await repositories.users.findByEmail(address)) {
        throw new EmailAlreadyExistsError()
      }

      return this.createToken(repositories, userId, 'email_change', this.deps.policy.emailChangeTtlMs, address)
    })

    this.send(this.deps.mailer.sendEmailChange(address, secret))
  }

  async confirmEmailChange(token: string): Promise<void> {
    await this.deps.unitOfWork.run(async (repositories) => {
      const { userId, newEmail } = await this.consumeToken(repositories, 'email_change', token)
      const user = await repositories.users.findById(userId)

      if (!user || !newEmail) {
        throw new InvalidTokenError()
      }
      if (await repositories.users.findByEmail(newEmail)) {
        throw new EmailAlreadyExistsError()
      }

      await repositories.users.update({ ...user, email: newEmail, updatedAt: this.deps.clock.now() })
      await this.markEmailVerified(repositories, userId)
    })
  }

  async requestAccountDeletion(userId: string, password: string): Promise<void> {
    const { secret, email } = await this.deps.unitOfWork.run(async (repositories) => {
      await this.requireMatchingPassword(repositories, userId, password)
      const user = await repositories.users.findById(userId)

      return {
        email: (user as User).email,
        secret: await this.createToken(repositories, userId, 'account_deletion', this.deps.policy.accountDeletionTtlMs)
      }
    })

    this.send(this.deps.mailer.sendAccountDeletion(email, secret))
  }

  async confirmAccountDeletion(token: string): Promise<void> {
    await this.deps.unitOfWork.run(async (repositories) => {
      const { userId } = await this.consumeToken(repositories, 'account_deletion', token)
      const user = await repositories.users.findById(userId)

      if (!user) {
        throw new InvalidTokenError()
      }

      await eraseAccount(repositories, user, this.deps.clock.now())
    })
  }

  private async startSession(
    repositories: Repositories,
    userId: string,
    userAgent: string | undefined
  ): Promise<SessionTokens> {
    const now = this.deps.clock.now()
    const refreshToken = this.deps.secrets.generate()
    const sessionId = this.deps.ids.next()

    await repositories.sessions.add({
      id: sessionId,
      userId,
      refreshTokenHash: this.deps.secrets.hash(refreshToken),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + this.deps.policy.sessionTtlMs),
      revokedAt: null,
      userAgent: userAgent ?? null
    })

    return { accessToken: this.deps.accessTokens.sign({ userId, sessionId }), refreshToken }
  }

  private async createToken(
    repositories: Repositories,
    userId: string,
    kind: AuthTokenKind,
    ttlMs: number,
    newEmail?: string
  ): Promise<string> {
    const now = this.deps.clock.now()
    const secret = this.deps.secrets.generate()

    await repositories.authTokens.expirePending(userId, kind, now)
    await repositories.authTokens.add({
      id: this.deps.ids.next(),
      userId,
      kind,
      tokenHash: this.deps.secrets.hash(secret),
      newEmail: newEmail ?? null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      usedAt: null
    })

    return secret
  }

  private async consumeToken(repositories: Repositories, kind: AuthTokenKind, secret: string) {
    const now = this.deps.clock.now()
    const token = await repositories.authTokens.findByHash(this.deps.secrets.hash(secret))

    if (!token || token.kind !== kind || !isAuthTokenUsable(token, now)) {
      throw new InvalidTokenError()
    }

    await repositories.authTokens.markUsed(token.id, now)

    return token
  }

  private async requireCredential(repositories: Repositories, userId: string): Promise<LocalCredential> {
    const credential = await repositories.credentials.findByUserId(userId)

    if (!credential) {
      throw new InvalidTokenError()
    }

    return credential
  }

  private async requireMatchingPassword(repositories: Repositories, userId: string, password: string) {
    const credential = await this.requireCredential(repositories, userId)

    if (!(await this.deps.hasher.verify(password, credential.passwordHash))) {
      throw new WrongPasswordError()
    }

    return credential
  }

  private async markEmailVerified(repositories: Repositories, userId: string) {
    const credential = await this.requireCredential(repositories, userId)
    await repositories.credentials.update({ ...credential, emailVerified: true, updatedAt: this.deps.clock.now() })
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash(this.deps.secrets.generate())
    return this.dummyHash
  }

  // Mail is sent after the transaction and never fails the request; a failure is logged
  private send(sending: Promise<void>) {
    sending.catch((error) => this.deps.logger.error(error))
  }
}
