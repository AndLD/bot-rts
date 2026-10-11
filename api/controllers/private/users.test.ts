import request from 'supertest'
import { asUser, makeApp, makeUser } from '../../tests/helpers'
import { usersService } from '../../services/users'
import { usersPrivateRouter } from '../../routers/private/users'

jest.mock('../../services/users', () => ({
  usersService: { findUserById: jest.fn(), listUsers: jest.fn(), updateUser: jest.fn() }
}))

const service = usersService as jest.Mocked<typeof usersService>
const targetId = '64b7f0f2a1b2c3d4e5f60999'

const appAs = (status: string) =>
  makeApp((app) => {
    app.use(asUser({ _id: 'actor', status }), usersPrivateRouter)
  })

beforeEach(() => jest.resetAllMocks())

describe('GET /users', () => {
  it('is admin-only', async () => {
    await request(appAs('user')).get('/').expect(403)
    expect(service.listUsers).not.toHaveBeenCalled()
  })

  it('lists users with typed filters and pagination', async () => {
    service.listUsers.mockResolvedValue({ users: [makeUser({ password: undefined as never })], total: 31 })

    const response = await request(appAs('admin')).get('/?page=2&results=10&status=user&active=true').expect(200)

    expect(service.listUsers).toHaveBeenCalledWith({ status: 'user', active: true }, 10, 10)
    expect(response.body.meta.pagination).toEqual({ page: 2, results: 10, total: 31 })
  })

  it('rejects operator injection and ignores the legacy filters parameter', async () => {
    service.listUsers.mockResolvedValue({ users: [], total: 0 })

    await request(appAs('admin')).get('/?email[$ne]=x').expect(400)
    await request(appAs('admin')).get('/?filters={"password":{"$regex":"^a"}}').expect(200)
    expect(service.listUsers).toHaveBeenCalledWith({}, 0, 10)
  })
})

describe('PUT /users/:id', () => {
  const put = (status: string, body: unknown, id = targetId) =>
    request(appAs(status))
      .put(`/${id}`)
      .send(body as object)

  it('is admin-only', async () => {
    await put('user', { name: 'Bob' }).expect(403)
  })

  it('rejects an invalid id and body', async () => {
    await put('admin', { name: 'Bob' }, 'bad').expect(400)
    await put('admin', { email: 'x@y.z' }).expect(400)
    expect(service.updateUser).not.toHaveBeenCalled()
  })

  it('lets an admin change name and subscription of a regular user', async () => {
    service.findUserById.mockResolvedValue(makeUser())
    service.updateUser.mockResolvedValue(makeUser({ name: 'Bob' }))

    const response = await put('admin', { name: 'Bob', subscription: 'monthly' }).expect(200)

    expect(service.updateUser).toHaveBeenCalledWith(targetId, { name: 'Bob', subscription: 'monthly' })
    expect(response.body.result.password).toBeUndefined()
  })

  it.each([{ status: 'banned' }, { active: false }, { password: 'Passw0rd!x' }])(
    'forbids an admin from setting %p',
    async (body) => {
      await put('admin', body).expect(403)
      expect(service.updateUser).not.toHaveBeenCalled()
    }
  )

  it('forbids an admin from editing admins and owners', async () => {
    service.findUserById.mockResolvedValue(makeUser({ status: 'admin' }))
    await put('admin', { name: 'Bob' }).expect(403)
    service.findUserById.mockResolvedValue(makeUser({ status: 'owner' }))
    await put('admin', { name: 'Bob' }).expect(403)
  })

  it('answers 404 for an unknown user', async () => {
    service.findUserById.mockResolvedValue(null)
    await put('owner', { status: 'banned' }).expect(404)
  })

  it('lets an owner change the status', async () => {
    service.findUserById.mockResolvedValue(makeUser({ status: 'admin' }))
    service.updateUser.mockResolvedValue(makeUser({ status: 'banned' }))

    await put('owner', { status: 'banned' }).expect(200)
    expect(service.updateUser).toHaveBeenCalledWith(targetId, { status: 'banned' })
  })
})
