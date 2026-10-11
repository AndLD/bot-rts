import { createAuthWorld } from '../../../tests/fakes/auth'
import { buildUser } from '../../../tests/integration/builders'
import { UnauthorizedError } from '../../shared/domain/errors'

describe('UserProvisioner.ensureUser', () => {
  it('returns the user linked to a known identity', async () => {
    const { provisioner, repositories } = createAuthWorld()
    const user = buildUser()
    repositories.users.items.set(user.id, user)
    repositories.identities.items.push({
      id: 'l1',
      provider: 'hosted',
      subject: 's1',
      userId: user.id,
      createdAt: new Date()
    })

    expect(
      await provisioner.ensureUser({ provider: 'hosted', subject: 's1', email: user.email, emailVerified: true })
    ).toEqual(user)
  })

  it('creates the user and the link when a hosted identity appears for the first time', async () => {
    const { provisioner, repositories, clock } = createAuthWorld()
    const identity = { provider: 'hosted', subject: 's2', email: 'newbie@example.com', emailVerified: true }

    const user = await provisioner.ensureUser(identity)

    expect(user).toMatchObject({
      name: 'newbie',
      email: 'newbie@example.com',
      status: 'user',
      createdAt: clock.current
    })
    expect(repositories.identities.items).toEqual([
      expect.objectContaining({ provider: 'hosted', subject: 's2', userId: user!.id })
    ])
    expect(await provisioner.ensureUser(identity)).toEqual(user)
  })

  it('does not invent users for the custom provider', async () => {
    const { provisioner } = createAuthWorld()

    await expect(
      provisioner.ensureUser({ provider: 'local', subject: 'ghost', email: 'g@example.com', emailVerified: true })
    ).rejects.toThrow(UnauthorizedError)
  })
})
