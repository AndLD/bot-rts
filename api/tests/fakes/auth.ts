import { AuthService } from '../../src/auth/application/auth.service'
import { LocalAuthService } from '../../src/auth/application/local-auth.service'
import { LocalIdentityVerifier } from '../../src/auth/application/local-identity.verifier'
import { UserProvisioner } from '../../src/auth/application/user-provisioner'
import { DEFAULT_AUTH_POLICY } from '../../src/auth/domain/auth-policy'
import { Logger } from '../../src/shared/application/logger'
import { FakeAccessTokenService, FakeHasher, FakeSecretGenerator, RecordingMailer } from './fakes'
import { createWorld } from './world'

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

  const auth = new LocalAuthService({ unitOfWork, hasher, secrets, accessTokens, mailer, ids, clock, policy, logger })
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
    secrets,
    accessTokens,
    hasher,
    logger,
    policy
  }
}
