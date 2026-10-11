import jwt from 'jsonwebtoken'
import request from 'supertest'
import { emailService } from '../../services/email'
import { usersService } from '../../services/users'
import { createEmailVerificationJwt, emailVerificationJwtSecret } from '../../utils/jwt'
import { makeApp, makeUser } from '../../tests/helpers'
import { usersPublicControllers } from './users'

jest.mock('../../services/users', () => ({
  usersService: { getUserByEmail: jest.fn(), addUser: jest.fn(), activateUser: jest.fn() }
}))
jest.mock('../../services/email', () => ({ emailService: { sendEmailVerification: jest.fn() } }))

const users = usersService as jest.Mocked<typeof usersService>
const userId = '64b7f0f2a1b2c3d4e5f60718'

const app = makeApp((app) => {
  app.post('/', usersPublicControllers.postUser)
  app.get('/verify', usersPublicControllers.getVerifyEmail)
})

beforeEach(() => jest.resetAllMocks())

describe('POST /', () => {
  const body = { email: 'alice@example.com', name: 'Alice', password: 'Passw0rd!x' }

  it('creates an unverified user, sends the email and returns tokens', async () => {
    users.getUserByEmail.mockResolvedValue(null)
    users.addUser.mockResolvedValue(makeUser({ active: false }))

    const response = await request(app).post('/').send(body).expect(200)

    expect(response.body.result).toEqual(expect.any(String))
    expect(users.addUser).toHaveBeenCalledWith(body)
    expect(emailService.sendEmailVerification).toHaveBeenCalledWith('alice@example.com', expect.any(String))
  })

  it('does not send the email to an already active user', async () => {
    users.getUserByEmail.mockResolvedValue(null)
    users.addUser.mockResolvedValue(makeUser({ active: true }))

    await request(app).post('/').send(body).expect(200)

    expect(emailService.sendEmailVerification).not.toHaveBeenCalled()
  })

  it('rejects a taken email', async () => {
    users.getUserByEmail.mockResolvedValue(makeUser())

    await request(app).post('/').send(body).expect(400)
  })
})

describe('GET /verify', () => {
  it('activates the user of a valid token', async () => {
    users.activateUser.mockResolvedValue(makeUser())

    await request(app)
      .get(`/verify?token=${createEmailVerificationJwt(userId)}`)
      .expect(200)

    expect(users.activateUser).toHaveBeenCalledWith(userId)
  })

  it('answers 404 when there is nothing to activate', async () => {
    users.activateUser.mockResolvedValue(null)

    await request(app)
      .get(`/verify?token=${createEmailVerificationJwt(userId)}`)
      .expect(404)
  })

  it('rejects a missing, repeated, invalid or wrongly shaped token', async () => {
    const wrongShape = jwt.sign({ user: { id: { $ne: 1 } } }, emailVerificationJwtSecret)

    await request(app).get('/verify').expect(400)
    await request(app).get('/verify?token=a&token=b').expect(400)
    await request(app).get('/verify?token=garbage').expect(401)
    await request(app).get(`/verify?token=${wrongShape}`).expect(401)
    expect(users.activateUser).not.toHaveBeenCalled()
  })
})
