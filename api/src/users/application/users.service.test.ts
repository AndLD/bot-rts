import { FakeClock, InMemoryUserRepository } from '../../../tests/fakes/fakes'
import { buildUser } from '../../../tests/integration/builders'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { UsersService } from './users.service'

function setup() {
  const repository = new InMemoryUserRepository()
  const clock = new FakeClock()
  return { repository, clock, service: new UsersService(repository, clock) }
}

describe('UsersService.get', () => {
  it('returns a user and hides missing and deleted ones', async () => {
    const { service, repository } = setup()
    const user = buildUser()
    const deleted = buildUser({ deletedAt: new Date() })
    await repository.add(user)
    await repository.add(deleted)

    expect(await service.get(user.id)).toEqual(user)
    await expect(service.get('missing')).rejects.toThrow(NotFoundError)
    await expect(service.get(deleted.id)).rejects.toThrow(NotFoundError)
  })
})

describe('UsersService.list', () => {
  it('turns page and size into an offset and limit and passes filters through', async () => {
    const { service, repository } = setup()
    for (let i = 0; i < 5; i += 1) {
      await repository.add(buildUser({ status: i === 0 ? 'admin' : 'user' }))
    }

    const page = await service.list({ page: 2, pageSize: 2 })
    expect(page.users).toHaveLength(2)
    expect(page.total).toBe(5)
    expect((await service.list({ page: 1, pageSize: 10, status: 'admin' })).total).toBe(1)
  })
})

describe('UsersService.update', () => {
  it('lets an admin edit a regular user and stamps updatedAt', async () => {
    const { service, repository, clock } = setup()
    const target = buildUser()
    await repository.add(target)
    repository.verified.add(target.id)

    const updated = await service.update('admin', target.id, { name: 'Bob', subscription: 'yearly', status: undefined })

    expect(updated).toEqual({
      ...target,
      name: 'Bob',
      subscription: 'yearly',
      updatedAt: clock.current,
      isEmailVerified: true
    })
    expect(await repository.findById(target.id)).toMatchObject({ name: 'Bob' })
  })

  it('lets an owner change the status', async () => {
    const { service, repository } = setup()
    const target = buildUser({ status: 'admin' })
    await repository.add(target)

    expect((await service.update('owner', target.id, { status: 'banned' })).status).toBe('banned')
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

describe('UsersService.countByStatus', () => {
  it('counts users by status', async () => {
    const { service, repository } = setup()
    await repository.add(buildUser({ status: 'admin' }))
    await repository.add(buildUser({ status: 'admin', deletedAt: new Date() }))

    expect((await service.countByStatus()).admin).toBe(1)
  })
})
