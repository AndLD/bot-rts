import { createAuthWorld } from '../../../tests/fakes/auth'
import { UnauthorizedError } from '../../shared/domain/errors'
import { identityVerifierContract } from '../../../tests/contracts/identity-verifier.contract'

const input = { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!x' }

identityVerifierContract('LocalIdentityVerifier', async () => {
  const world = createAuthWorld()
  const { accessToken } = await world.auth.register(input)
  const user = (await world.repositories.users.findByEmail(input.email))!

  return {
    verifier: world.verifier,
    validToken: accessToken,
    expected: { provider: 'local', subject: user.id, email: input.email, emailVerified: false }
  }
})

describe('LocalIdentityVerifier specifics', () => {
  it('rejects a token of a session that belongs to another user, and a user without a credential', async () => {
    const world = createAuthWorld()
    const { accessToken } = await world.auth.register(input)
    const user = (await world.repositories.users.findByEmail(input.email))!
    const [, , sessionId] = accessToken.split('.')

    await expect(world.verifier.verify(`access.someone-else.${sessionId}`)).rejects.toThrow(UnauthorizedError)

    world.repositories.credentials.items.delete(user.id)
    await expect(world.verifier.verify(accessToken)).rejects.toThrow(UnauthorizedError)
  })

  it('rejects a token of a deleted user and an expired session', async () => {
    const world = createAuthWorld()
    const { accessToken } = await world.auth.register(input)
    const user = (await world.repositories.users.findByEmail(input.email))!

    world.clock.current = new Date(world.clock.current.getTime() + world.policy.sessionTtlMs + 1)
    await expect(world.verifier.verify(accessToken)).rejects.toThrow(UnauthorizedError)

    world.clock.current = new Date()
    world.repositories.users.items.delete(user.id)
    await expect(world.verifier.verify(accessToken)).rejects.toThrow(UnauthorizedError)
  })
})
