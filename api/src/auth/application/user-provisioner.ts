import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { UnauthorizedError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { User } from '../../users/domain/user.entity'
import { Identity } from '../domain/identity'
import { IdentityRepository } from './ports'

// Maps a verified identity to the player, creating the player on first sight (lazy provisioning)
export class UserProvisioner {
  constructor(
    private readonly users: UserRepository,
    private readonly identities: IdentityRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async ensureUser(identity: Identity): Promise<User | null> {
    const link = await this.identities.findByIdentity(identity.provider, identity.subject)

    if (link) {
      return this.users.findById(link.userId)
    }

    // The custom provider creates its users at registration; an unknown local subject is a stale token
    if (identity.provider === 'local') {
      throw new UnauthorizedError('Unknown user')
    }

    const now = this.clock.now()
    const user: User = {
      id: this.ids.next(),
      name: identity.email.split('@')[0],
      email: identity.email,
      status: 'user',
      subscription: 'free',
      createdAt: now,
      updatedAt: null,
      deletedAt: null
    }
    await this.users.add(user)
    await this.identities.add({
      id: this.ids.next(),
      provider: identity.provider,
      subject: identity.subject,
      userId: user.id,
      createdAt: now
    })

    return user
  }
}
