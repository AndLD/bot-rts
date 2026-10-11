import { UserStatus } from '../../../lib/utils/interfaces/users'
import request from 'supertest'
import { createFakeServices } from '../../tests/fakes/services'
import { buildUser } from '../../tests/integration/builders'
import { asUser, makeApp } from '../../tests/http'
import { createUsersPrivateRouter } from './users'

function setup(actorStatus: UserStatus) {
  const fake = createFakeServices()
  const actor = buildUser({ status: actorStatus })
  const app = makeApp((app) => {
    app.use(asUser(actor), createUsersPrivateRouter(fake.services))
  })
  return { ...fake, app }
}

describe('GET /users', () => {
  it('is admin-only', async () => {
    await request(setup('user').app).get('/').expect(403)
  })

  it('lists users with typed filters and pagination, without password hashes', async () => {
    const { app, repositories } = setup('admin')
    for (let i = 0; i < 3; i += 1) {
      const user = buildUser({ status: i === 0 ? 'unlimited' : 'user' })
      repositories.users.items.set(user.id, user)
    }

    const response = await request(app).get('/?status=user&page=1&results=1').expect(200)

    expect(response.body.result).toHaveLength(1)
    expect(response.body.meta.pagination).toEqual({ page: 1, results: 1, total: 2 })
    expect(JSON.stringify(response.body)).not.toContain('passwordHash')
    expect((await request(app).get('/?active=false').expect(200)).body.result).toEqual([])
  })

  it('does not let query-string syntax smuggle operators into the filter', async () => {
    const { app, repositories } = setup('admin')
    const user = buildUser({ email: 'a@example.com' })
    repositories.users.items.set(user.id, user)

    // Express 5 does not parse `email[$ne]=x` into an object; the key is ignored and a repeated key is rejected
    expect((await request(app).get('/?email[$ne]=x').expect(200)).body.result).toHaveLength(1)
    await request(app).get('/?email=a&email=b').expect(400)
  })
})

describe('PUT /users/:id', () => {
  const put = (app: ReturnType<typeof setup>['app'], body: unknown, id: string) =>
    request(app)
      .put(`/${id}`)
      .send(body as object)

  it('is admin-only', async () => {
    const { app } = setup('user')
    await put(app, { name: 'Bob' }, '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e').expect(403)
  })

  it('rejects an invalid id and body', async () => {
    const { app } = setup('admin')
    await put(app, { name: 'Bob' }, 'bad').expect(400)
    await put(app, { email: 'x@y.z' }, '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e').expect(400)
  })

  it('lets an admin change name and subscription of a regular user', async () => {
    const { app, repositories } = setup('admin')
    const target = buildUser()
    repositories.users.items.set(target.id, target)

    const response = await put(app, { name: 'Bob', subscription: 'monthly' }, target.id).expect(200)

    expect(response.body.result).toMatchObject({ _id: target.id, name: 'Bob', subscription: 'monthly' })
    expect(JSON.stringify(response.body)).not.toContain('hash')
  })

  it('forbids an admin from privileged changes and from editing admins', async () => {
    const { app, repositories } = setup('admin')
    const regular = buildUser()
    const other = buildUser({ status: 'admin' })
    repositories.users.items.set(regular.id, regular)
    repositories.users.items.set(other.id, other)

    await put(app, { status: 'banned' }, regular.id).expect(403)
    await put(app, { active: false }, regular.id).expect(403)
    await put(app, { name: 'Bob' }, other.id).expect(403)
  })

  it('answers 404 for an unknown user and lets an owner change the status', async () => {
    const { app, repositories } = setup('owner')
    const target = buildUser()
    repositories.users.items.set(target.id, target)

    await put(app, { status: 'banned' }, '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e').expect(404)
    const response = await put(app, { status: 'banned', active: false }, target.id).expect(200)
    expect(response.body.result).toMatchObject({ status: 'banned', active: false })
  })
})
