import { Repositories } from '../../persistence/application/unit-of-work'
import { User } from '../../users/domain/user.entity'

export const DELETED_PLAYER_NAME = 'Deleted player'

// Erases the personal data of an account: name, email, credentials, logins and pending links. The user row stays, so that the
// player's base can become a corpse base (privacy policy, "How long we keep it"). The account is deleted by its player
// (confirmed by email) or by the data lifecycle job after a long inactivity.
export async function eraseAccount(repositories: Repositories, user: User, now: Date): Promise<void> {
  await repositories.users.update({
    ...user,
    name: DELETED_PLAYER_NAME,
    email: `deleted-${user.id}@deleted.invalid`,
    deletedAt: now
  })
  await repositories.sessions.deleteByUserId(user.id)
  await repositories.authTokens.deleteByUserId(user.id)
  await repositories.credentials.deleteByUserId(user.id)
  await repositories.identities.deleteByUserId(user.id)
}
