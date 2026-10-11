import { createWorld } from '../../../tests/fakes/world'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { ScanService } from './scan.service'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

function setup() {
  const world = createWorld()
  const scanService = new ScanService(
    world.botsService,
    world.repositories.modules,
    world.repositories.map,
    world.mapService,
    world.moduleRegistry,
    world.clock,
    world.energyService
  )
  return { ...world, scanService }
}

describe('ScanService.scan', () => {
  it('shows the player the cells within the scanner distance of the bot', async () => {
    const { botsService, scanService } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })

    const seen = await scanService.scan(alice.id, bot.id)

    // scanner-class1 has distance 1: a 3x3 square around the base
    expect(seen).toHaveLength(9)
    expect(Math.min(...seen.map((p) => p.location.x))).toBe(4)
    expect(Math.max(...seen.map((p) => p.location.y))).toBe(6)
    expect(seen.find((p) => p.location.x === 5 && p.location.y === 5)?.contentId).toBe(bot.id)
  })

  it('requires an own bot with a scanner and a position', async () => {
    const { botsService, scanService, repositories } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })

    await expect(scanService.scan('someone-else', bot.id)).rejects.toThrow()

    repositories.modules.items.splice(
      0,
      repositories.modules.items.length,
      ...repositories.modules.items.filter((m) => m.type !== 'scanner')
    )
    await expect(scanService.scan(alice.id, bot.id)).rejects.toThrow(ValidationError)
  })

  it('reports a bot that is not on the map', async () => {
    const { botsService, scanService, repositories } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })
    repositories.map.points.clear()

    await expect(scanService.scan(alice.id, bot.id)).rejects.toThrow(NotFoundError)
  })

  it('treats a scanner without distance as range zero', async () => {
    const { botsService, scanService, repositories } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })
    const index = repositories.modules.items.findIndex((m) => m.type === 'scanner')
    repositories.modules.items[index] = { ...repositories.modules.items[index], props: {} }

    expect(await scanService.scan(alice.id, bot.id)).toHaveLength(1)
  })

  it('starts the cooldown of the scanner and refuses a scan during it', async () => {
    const { botsService, scanService, clock, repositories } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })

    await scanService.scan(alice.id, bot.id)
    const scanner = repositories.modules.items.find((m) => m.type === 'scanner')
    expect(scanner?.props.readyAt).toBe(clock.now().getTime() + 250)

    await expect(scanService.scan(alice.id, bot.id)).rejects.toMatchObject({ statusCode: 409, code: 'COOLDOWN' })

    clock.current = new Date(clock.now().getTime() + 250)
    await expect(scanService.scan(alice.id, bot.id)).resolves.toHaveLength(9)
  })

  it('refuses a broken scanner and a scanner that is live', async () => {
    const { botsService, scanService, repositories } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })
    const index = repositories.modules.items.findIndex((m) => m.type === 'scanner')
    const original = repositories.modules.items[index]

    repositories.modules.items[index] = { ...original, props: { ...original.props, isLive: true } }
    await expect(scanService.scan(alice.id, bot.id)).rejects.toMatchObject({ code: 'BUSY' })

    repositories.modules.items[index] = { ...original, condition: 0 }
    await expect(scanService.scan(alice.id, bot.id)).rejects.toMatchObject({ code: 'BROKEN_MODULE' })
  })

  it('charges the energy of the scan to the battery, and refuses a scan the battery cannot pay', async () => {
    const { botsService, scanService, repositories, clock } = setup()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 5, y: 5, z: 0 } })
    const battery = () => repositories.modules.items.find((m) => m.type === 'battery')

    await scanService.scan(alice.id, bot.id)
    // 3x3 cells at 1 energy each
    expect(battery()?.props.value).toBe(3000 - 9)

    repositories.modules.items[repositories.modules.items.findIndex((m) => m.type === 'battery')] = {
      ...(battery() as NonNullable<ReturnType<typeof battery>>),
      props: { capacity: 3000, value: 5 }
    }
    const scanner = () => repositories.modules.items.find((m) => m.type === 'scanner')
    const before = scanner()
    clock.current = new Date(clock.now().getTime() + 250)
    await expect(scanService.scan(alice.id, bot.id)).rejects.toMatchObject({ statusCode: 409, code: 'NO_ENERGY' })
    expect(scanner()).toBe(before)
  })
})
