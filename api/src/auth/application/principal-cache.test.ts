import { FakeClock } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { AuthService, Principal } from './auth.service'
import { PrincipalCache } from './principal-cache'

const principal = (): Principal => ({
  user: buildUser(),
  identity: { provider: 'local', subject: 's', email: 'a@b.c', emailVerified: true }
})

describe('PrincipalCache', () => {
  it('remembers a token owner until the time is up', () => {
    const clock = new FakeClock()
    const cache = new PrincipalCache(clock, 2000)
    const owner = principal()

    cache.set('t', owner)
    expect(cache.get('t')).toBe(owner)
    clock.current = new Date(clock.current.getTime() + 1999)
    expect(cache.get('t')).toBe(owner)
    clock.current = new Date(clock.current.getTime() + 1)
    expect(cache.get('t')).toBeUndefined()
    expect(cache.get('unknown')).toBeUndefined()
  })

  it('remembers nothing when switched off', () => {
    const cache = new PrincipalCache(new FakeClock(), 0)

    cache.set('t', principal())

    expect(cache.get('t')).toBeUndefined()
  })

  it('makes room by forgetting the oldest entry', () => {
    const cache = new PrincipalCache(new FakeClock(), 1000, 2)
    cache.set('a', principal())
    cache.set('b', principal())
    cache.set('c', principal())

    expect([cache.get('a'), cache.get('b'), cache.get('c')].map(Boolean)).toEqual([false, true, true])
  })
})

describe('AuthService with the cache', () => {
  it('verifies a token once for the length of the cache time', async () => {
    const owner = principal()
    const verifier = { verify: jest.fn(async () => owner.identity) }
    const provisioner = { ensureUser: jest.fn(async () => ({ ...owner.user, status: 'user' as const })) }
    const service = new AuthService(verifier, provisioner as never, new PrincipalCache(new FakeClock(), 1000))

    const first = await service.authenticate('t')
    const second = await service.authenticate('t')

    expect(second).toBe(first)
    expect(verifier.verify).toHaveBeenCalledTimes(1)
  })

  it('does not remember a token that was refused', async () => {
    const verifier = { verify: jest.fn().mockRejectedValue(new Error('no')) }
    const service = new AuthService(verifier, {} as never, new PrincipalCache(new FakeClock(), 1000))

    await expect(service.authenticate('t')).rejects.toThrow('no')
    await expect(service.authenticate('t')).rejects.toThrow('no')
    expect(verifier.verify).toHaveBeenCalledTimes(2)
  })
})
