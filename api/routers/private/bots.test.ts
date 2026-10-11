import request from 'supertest'
import { createFakeServices } from '../../tests/fakes/services'
import { buildUser } from '../../tests/integration/builders'
import { asUser, makeApp } from '../../tests/http'
import { createBotsPrivateRouter } from './bots'

function setup() {
  const fake = createFakeServices()
  const player = buildUser({ name: 'Alice' })
  const app = makeApp((app) => {
    app.use(asUser(player), createBotsPrivateRouter(fake.services))
  })
  return { ...fake, app, player }
}

const botId = '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e'

describe('POST /base', () => {
  it('deploys the base with its modules and map point', async () => {
    const { app, player } = setup()

    const response = await request(app).post('/base').expect(200)

    expect(response.body.bot).toMatchObject({ label: 'Alice base', userId: player.id, type: 'base' })
    expect(response.body.modules).toHaveLength(7)
    expect(response.body.modules[0]).toMatchObject({ botId: response.body.bot._id, type: 'weapon', damage: 50 })
    expect(response.body.mapPoint).toMatchObject({ contentId: response.body.bot._id, type: 'base' })
  })

  it('allows one base per player', async () => {
    const { app } = setup()
    await request(app).post('/base').expect(200)

    expect((await request(app).post('/base').expect(403)).body.code).toBe('BASE_ALREADY_EXISTS')
  })
})

describe('POST /:id/scan', () => {
  it('returns the cells around the bot as known to the player', async () => {
    const { app } = setup()
    const { body: deployed } = await request(app).post('/base').expect(200)

    const response = await request(app).post(`/${deployed.bot._id}/scan`).expect(200)

    expect(response.body).toHaveLength(9)
    expect(response.body[0]).toMatchObject({ userId: expect.any(String), seenAt: expect.any(Number) })
  })

  it('rejects an invalid id and a bot of someone else', async () => {
    const { app, repositories } = setup()
    await request(app).post('/not-an-id/scan').expect(400)
    await request(app).post(`/${botId}/scan`).expect(404)

    repositories.bots.items.set(botId, {
      id: botId,
      label: null,
      type: 'base' as never,
      userId: 'someone-else',
      baseId: null
    })
    await request(app).post(`/${botId}/scan`).expect(403)
  })
})
