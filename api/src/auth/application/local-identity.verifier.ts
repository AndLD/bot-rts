import { Clock } from '../../shared/application/clock'
import { UnauthorizedError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { LOCAL_PROVIDER, Identity } from '../domain/identity'
import { isSessionActive } from '../domain/session'
import { IdentityVerifier } from './identity-verifier'
import { AccessTokenService, CredentialRepository, SessionRepository } from './ports'

// The identity verifier of the custom provider: a valid access token whose session was not revoked
export class LocalIdentityVerifier implements IdentityVerifier {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly sessions: SessionRepository,
    private readonly credentials: CredentialRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock
  ) {}

  async verify(token: string): Promise<Identity> {
    const { userId, sessionId } = this.accessTokens.verify(token)
    const session = await this.sessions.findById(sessionId)

    if (!session || session.userId !== userId || !isSessionActive(session, this.clock.now())) {
      throw new UnauthorizedError('The session has ended')
    }

    const [user, credential] = await Promise.all([this.users.findById(userId), this.credentials.findByUserId(userId)])

    if (!user || !credential) {
      throw new UnauthorizedError('Unknown user')
    }

    return {
      provider: LOCAL_PROVIDER,
      subject: userId,
      email: user.email,
      emailVerified: credential.emailVerified,
      sessionId,
      ...(session.viewAs ? { viewAs: { ...session.viewAs, expiresAt: session.expiresAt } } : {})
    }
  }
}
