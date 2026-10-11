import { FakeClock, FakeHasher, InMemoryUserRepository, SequentialIdGenerator } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors'
import { EmailNotVerifiedError, UserBannedError } from '../domain/user.errors'
import { CredentialsInvalidError, EmailAlreadyExistsError } from '../domain/user.errors'
import { UsersService } from './users.service'

function setup() {
  const repository = new InMemoryUserRepository()
  const clock = new FakeClock()
  const service = new UsersService(repository, new FakeHasher(), new SequentialIdGenerator(), clock)
  return { repository, clock, service }
}

describe('UsersService.register', () => {
  it('stores an unverified regular user with a hashed password', async () => {
    const { service, repository, clock } = setup()

    const user = await service.register({ name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!' })

    expect(user).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hashed:Passw0rd!',
      status: 'user',
      isActive: false,
      subscription: 'free',
      createdAt: clock.current,
      updatedAt: null
    })
    expect(await repository.findById(user.id)).toEqual(user)
  })

  it('rejects a taken email', async () => {
    const { service } = setup()
    const input = { name: 'Alice', email: 'alice@example.com', password: 'Passw0rd!' }
    await service.register(input)

    await expect(service.register(input)).rejects.toThrow(EmailAlreadyExistsError)
  })
})

describe('UsersService.authenticate', () => {
  it('returns an active user with the right password', async () => {
    const { service, repository } = setup()
    const user = buildUser({ email: 'a@example.com', passwordHash: 'hashed:secret' })
    await repository.add(user)

    expect(await service.authenticate('a@example.com', 'secret')).toEqual(user)
  })

  it('rejects an unknown email and a wrong password the same way', async () => {
    const { service, repository } = setup()
    await repository.add(buildUser({ email: 'a@example.com', passwordHash: 'hashed:secret' }))

    await expect(service.authenticate('x@example.com', 'secret')).rejects.toThrow(CredentialsInvalidError)
    await expect(service.authenticate('a@example.com', 'wrong')).rejects.toThrow(CredentialsInvalidError)
  })

  it('rejects banned and unverified users only after the password matched', async () => {
    const { service, repository } = setup()
    await repository.add(buildUser({ email: 'b@example.com', passwordHash: 'hashed:p', status: 'banned' }))
    await repository.add(buildUser({ email: 'u@example.com', passwordHash: 'hashed:p', isActive: false }))

    await expect(service.authenticate('b@example.com', 'p')).rejects.toThrow(UserBannedError)
    await expect(service.authenticate('u@example.com', 'p')).rejects.toThrow(EmailNotVerifiedError)
    await expect(service.authenticate('b@example.com', 'bad')).rejects.toThrow(CredentialsInvalidError)
  })
})

describe('UsersService.getUsableUser', () => {
  it('returns the stored user and rejects unusable accounts', async () => {
    const { service, repository } = setup()
    const active = buildUser()
    const banned = buildUser({ status: 'banned' })
    await repository.add(active)
    await repository.add(banned)

    expect(await service.getUsableUser(active.id)).toEqual(active)
    await expect(service.getUsableUser(banned.id)).rejects.toThrow(UserBannedError)
    await expect(service.getUsableUser('missing')).rejects.toThrow(UnauthorizedError)
  })
})

describe('UsersService.activate', () => {
  it('activates a waiting user', async () => {
    const { service, repository } = setup()
    const user = buildUser({ isActive: false })
    await repository.add(user)

    expect((await service.activate(user.id)).isActive).toBe(true)
    expect((await repository.findById(user.id))?.isActive).toBe(true)
  })

  it('finds nothing to activate for unknown or already active users', async () => {
    const { service, repository } = setup()
    const active = buildUser()
    await repository.add(active)

    await expect(service.activate('missing')).rejects.toThrow(NotFoundError)
    await expect(service.activate(active.id)).rejects.toThrow(NotFoundError)
  })
})

describe('UsersService.list', () => {
  it('turns page and size into an offset and limit', async () => {
    const { service, repository } = setup()
    for (let i = 0; i < 5; i += 1) {
      await repository.add(buildUser())
    }

    const page = await service.list({ page: 2, pageSize: 2 })

    expect(page.users).toHaveLength(2)
    expect(page.total).toBe(5)
  })

  it('passes filters through', async () => {
    const { service, repository } = setup()
    await repository.add(buildUser({ status: 'admin' }))
    await repository.add(buildUser())

    expect((await service.list({ page: 1, pageSize: 10, status: 'admin' })).total).toBe(1)
  })
})

describe('UsersService.update', () => {
  it('lets an admin edit a regular user and stamps updatedAt', async () => {
    const { service, repository, clock } = setup()
    const target = buildUser()
    await repository.add(target)

    const updated = await service.update('admin', target.id, { name: 'Bob', subscription: 'yearly' })

    expect(updated).toEqual({ ...target, name: 'Bob', subscription: 'yearly', updatedAt: clock.current })
    expect(await repository.findById(target.id)).toEqual(updated)
  })

  it('hashes a new password for an owner and ignores fields that were not sent', async () => {
    const { service, repository } = setup()
    const target = buildUser({ status: 'admin' })
    await repository.add(target)

    const updated = await service.update('owner', target.id, { password: 'NewPassw0rd!', status: undefined })

    expect(updated.passwordHash).toBe('hashed:NewPassw0rd!')
    expect(updated.status).toBe('admin')
  })

  it('reports an unknown user and refuses forbidden changes', async () => {
    const { service, repository } = setup()
    const target = buildUser()
    await repository.add(target)

    await expect(service.update('admin', 'missing', { name: 'Bob' })).rejects.toThrow(NotFoundError)
    await expect(service.update('admin', target.id, { status: 'banned' })).rejects.toThrow(ForbiddenError)
    await expect(service.update('user', target.id, { name: 'Bob' })).rejects.toThrow(ForbiddenError)
  })
})

describe('UsersService maintenance', () => {
  it('counts users by status', async () => {
    const { service, repository } = setup()
    await repository.add(buildUser({ status: 'admin' }))

    expect((await service.countByStatus()).admin).toBe(1)
  })

  it('purges unverified users older than a day', async () => {
    const { service, repository, clock } = setup()
    const stale = buildUser({ isActive: false, createdAt: new Date(clock.current.getTime() - 25 * 3600 * 1000) })
    const fresh = buildUser({ isActive: false, createdAt: new Date(clock.current.getTime() - 3600 * 1000) })
    await repository.add(stale)
    await repository.add(fresh)

    expect(await service.purgeUnverified()).toBe(1)
    expect(await repository.findById(stale.id)).toBeNull()
    expect(await repository.findById(fresh.id)).not.toBeNull()
  })
})
