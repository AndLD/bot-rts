import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { createWorld } from '../../../tests/fakes/world'
import { StorageModule, BatteryModule } from '../domain/game-module'
import { ENERGY_EVENT } from '../domain/energy-model'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

async function setup() {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice, { password: 'secret1' })
  const stored = <T>(type: string, moduleClass: new (record: never) => T) =>
    new moduleClass(world.repositories.modules.items.find((m) => m.botId === bot.id && m.type === type) as never)
  return {
    ...world,
    bot,
    battery: () => stored('battery', BatteryModule),
    storage: () => stored('storage', StorageModule)
  }
}

describe('EnergyService', () => {
  it('starts a base with a full battery and 50 oil', async () => {
    const { battery, storage } = await setup()

    expect(battery().value).toBe(3000)
    expect(storage().amountOf(RESOURCE.OIL)).toBe(50)
  })

  it('takes the cost of an operation out of the battery', async () => {
    const { energyService, bot, battery } = await setup()

    await energyService.pay(bot.id, 100)

    expect(battery().value).toBe(2900)
  })

  it('refuses an operation the battery cannot pay and changes nothing', async () => {
    const { energyService, bot, battery } = await setup()

    await expect(energyService.pay(bot.id, 5000)).rejects.toMatchObject({ statusCode: 409, code: 'NO_ENERGY' })
    expect(battery().value).toBe(3000)
  })

  it('runs a tick: idle drain, then the generator refills and burns oil', async () => {
    const { energyService, bot, battery, storage, clock } = await setup()
    await energyService.pay(bot.id, 1000)
    const start = clock.now().getTime()

    await energyService.tick(bot.id, start)
    const afterFirst = battery().value
    expect(afterFirst).toBeLessThan(2000)

    const events = await energyService.tick(bot.id, start + 1000)

    // four cycles of 12 energy for 0.02 oil each
    expect(battery().value).toBeGreaterThan(afterFirst + 40)
    expect(storage().amountOf(RESOURCE.OIL)).toBeCloseTo(50 - 0.08)
    expect(events).toEqual([{ type: ENERGY_EVENT.GENERATOR_FUELLED, moduleId: expect.any(String) }])
  })

  it('reports an empty fuel tank', async () => {
    const { energyService, bot, repositories, clock } = await setup()
    await energyService.pay(bot.id, 1000)
    const index = repositories.modules.items.findIndex((m) => m.type === 'storage')
    repositories.modules.items[index] = { ...repositories.modules.items[index], props: { capacity: 200, items: [] } }
    const start = clock.now().getTime()
    await energyService.tick(bot.id, start)

    expect(await energyService.tick(bot.id, start + 1000)).toContainEqual({
      type: ENERGY_EVENT.OUT_OF_FUEL,
      moduleId: expect.any(String)
    })
  })
})
