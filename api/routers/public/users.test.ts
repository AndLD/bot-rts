import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createFakeServices } from '../../tests/fakes/services'
import { buildUser } from '../../tests/integration/builders'
import { makeApp } from '../../tests/http'
import { createEmailVerificationJwt, emailVerificationJwtSecret } from '../../utils/jwt'
import { createUsersPublicRouter } from './users'

function setup() {
  const fake = createFakeServices()
  const app = makeApp((app) => {
    app.use(createUsersPublicRouter(fake.services))
  })
  return { ...fake, app }
}

const body = { email: 'alice@example.com', name: 'Alice', password: 'Passw0rd!x' }

describe('POST / (signup)', () => {
  it('creates an unverified user, returns tokens and sends the verification mail', async () => {
    const { app, repositories, sender } = setup()

    const response = await request(app).post('/').send(body).expect(200)

    const [user] = [...repositories.users.items.values()]
    expect(user).toMatchObject({ email: 'alice@example.com', status: 'user', isActive: false })
    expect(jwt.decode(response.body.result)).toMatchObject({ user: { _id: user.id, active: false } })
    expect(response.headers['set-cookie'][0]).toContain('refreshToken=')
    expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@example.com' }))
  })

  it('still answers when the mail server fails', async () => {
    const { app, sender } = setup()
    sender.send.mockRejectedValue(new Error('smtp down'))

    await request(app).post('/').send(body).expect(200)
  })

  it('rejects a taken email and an invalid body', async () => {
    const { app } = setup()
    await request(app).post('/').send(body).expect(200)

    expect((await request(app).post('/').send(body).expect(400)).body.code).toBe('EMAIL_ALREADY_EXISTS')
    await request(app)
      .post('/')
      .send({ ...body, password: 'weak' })
      .expect(400)
  })
})

describe('GET /verify', () => {
  it('activates the user of a valid token', async () => {
    const { app, repositories } = setup()
    const user = buildUser({ isActive: false })
    repositories.users.items.set(user.id, user)

    await request(app)
      .get(`/verify?token=${createEmailVerificationJwt(user.id)}`)
      .expect(200)

    expect(repositories.users.items.get(user.id)?.isActive).toBe(true)
  })

  it('answers 404 when there is nothing to activate', async () => {
    const { app, repositories } = setup()
    const user = buildUser()
    repositories.users.items.set(user.id, user)

    await request(app)
      .get(`/verify?token=${createEmailVerificationJwt(user.id)}`)
      .expect(404)
  })

  it('rejects a missing, repeated, invalid or wrongly shaped token', async () => {
    const { app } = setup()
    const wrongShape = jwt.sign({ user: { id: { $ne: 1 } } }, emailVerificationJwtSecret)

    await request(app).get('/verify').expect(400)
    await request(app).get('/verify?token=a&token=b').expect(400)
    await request(app).get('/verify?token=garbage').expect(401)
    await request(app).get(`/verify?token=${wrongShape}`).expect(401)
  })
})
