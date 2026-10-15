import { LoginAttemptLog, PlayerActivityLog } from '../../src/auth/application/ports'
import { LoginAttempt } from '../../src/auth/domain/login-attempt'
import { AuthService } from '../../src/auth/application/auth.service'
import { LocalAuthService } from '../../src/auth/application/local-auth.service'
import { LocalIdentityVerifier } from '../../src/auth/application/local-identity.verifier'
import { UserProvisioner } from '../../src/auth/application/user-provisioner'
import { DEFAULT_AUTH_POLICY } from '../../src/auth/domain/auth-policy'
import { Logger } from '../../src/shared/application/logger'
import { FakeAccessTokenService, FakeHasher, FakeSecretGenerator, RecordingMailer } from './fakes'
import { createWorld } from './world'

export class RecordingLoginAttempts implements LoginAttemptLog {
  readonly items: LoginAttempt[] = []
  isFailing = false

  async record(attempt: LoginAttempt) {
    if (this.isFailing) {
      throw new Error('the log is down')
    }
    this.items.push(attempt)
  }
}

export class RecordingActivity implements PlayerActivityLog {
  readonly items: Array<{ userId: string; at: Date }> = []
  isFailing = false

  async touch(userId: string, at: Date) {
    if (this.isFailing) {
      throw new Error('the log is down')
    }
    this.items.push({ userId, at })
  }
}

// The custom auth provider and the authentication use case wired with fakes
export function createAuthWorld(options: Parameters<typeof createWorld>[0] = {}) {
  const world = createWorld(options)
  const { repositories, unitOfWork, ids, clock } = world
  const hasher = new FakeHasher()
  const secrets = new FakeSecretGenerator()
  const accessTokens = new FakeAccessTokenService()
  const mailer = new RecordingMailer()
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const policy = DEFAULT_AUTH_POLICY
  const attempts = new RecordingLoginAttempts()
  const activity = new RecordingActivity()

  const auth = new LocalAuthService({
    unitOfWork,
    hasher,
    secrets,
    accessTokens,
    mailer,
    ids,
    clock,
    policy,
    logger,
    attempts,
    activity
  })
  const verifier = new LocalIdentityVerifier(
    accessTokens,
    repositories.sessions,
    repositories.credentials,
    repositories.users,
    clock
  )
  const provisioner = new UserProvisioner(repositories.users, repositories.identities, ids, clock)

  return {
    ...world,
    auth,
    authService: new AuthService(verifier, provisioner),
    verifier,
    provisioner,
    mailer,
    attempts,
    activity,
    secrets,
    accessTokens,
    hasher,
    logger,
    policy
  }
}
