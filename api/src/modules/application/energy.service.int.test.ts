import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { buildBase, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { UuidIdGenerator } from '../../shared/infrastructure/uuid-id-generator'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { ENERGY_EVENT, EnergyModel } from '../domain/energy-model'
import { BatteryModule, StorageModule } from '../domain/game-module'
import { createModuleRegistry } from '../domain/module-registry'
import { ScannerModule } from '../domain/scanner-module'
import { PrismaModuleRepository } from '../infrastructure/prisma-module.repository'
import { EnergyService } from './energy.service'
import { ModuleFactory } from './module.factory'

let database: TestDatabase
let modules: PrismaModuleRepository
let service: EnergyService
let baseId: string

beforeAll(async () => {
  database = await createTestDatabase()
  modules = new PrismaModuleRepository(database.client)
  service = new EnergyService(modules, new EnergyModel(createModuleRegistry()))
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  baseId = base.id
  // The energy rules of the oil generator are under test: the base starts on a solar panel, so put a generator in its place
  const factory = new ModuleFactory(new UuidIdGenerator())
  await modules.addMany([
    ...factory.starterKit(base.id).filter((module) => module.type !== 'solarPanel'),
    factory.create('generator-class1', base.id)
  ])
})
afterAll(() => database.drop())

const stored = async <T>(type: string, moduleClass: new (record: never) => T) =>
  new moduleClass((await modules.listOfBot(baseId)).find((m) => m.type === type) as never)
const change = async (type: string, props: Record<string, unknown>) => {
  const record = (await modules.listOfBot(baseId)).find((m) => m.type === type)!
  await modules.update({ ...record, props: { ...record.props, ...props } })
}

describe('energy accounting against PostgreSQL', () => {
  it('pays an operation and refuses one the battery cannot pay', async () => {
    await service.pay(baseId, 100)
    expect((await stored('battery', BatteryModule)).value).toBe(2900)

    await expect(service.pay(baseId, 5000)).rejects.toMatchObject({ code: 'NO_ENERGY' })
    expect((await stored('battery', BatteryModule)).value).toBe(2900)
  })

  it('drains the idle cost, refills from the generator and burns oil, all persisted', async () => {
    await change('battery', { value: 100 })
    await change('generator', { lastCycleAt: 0 })

    const events = await service.tick(baseId, 1000)

    // four cycles: +48 energy for 0.08 oil, minus the idle cost of the working modules
    const battery = await stored('battery', BatteryModule)
    expect(battery.value).toBeGreaterThan(100 + 40)
    expect((await stored('storage', StorageModule)).amountOf(RESOURCE.OIL)).toBeCloseTo(50 - 0.08)
    // 140 of 3000 is under a tenth of the capacity
    expect(events).toEqual([{ type: ENERGY_EVENT.LOW }])
  })

  it('reports a generator that ran out of oil', async () => {
    await change('battery', { value: 100 })
    await change('generator', { lastCycleAt: 0 })
    await change('storage', { items: [] })

    expect(await service.tick(baseId, 1000)).toContainEqual({
      type: ENERGY_EVENT.OUT_OF_FUEL,
      moduleId: expect.any(String)
    })
  })

  it('switches a live scanner off when the battery runs dry', async () => {
    await change('generator', { isEnabled: false })
    await change('scanner', { isLive: true })
    await change('battery', { value: 5 })

    const events = await service.tick(baseId, 0)

    expect((await stored('scanner', ScannerModule)).isLive).toBe(false)
    expect(events).toContainEqual({ type: ENERGY_EVENT.LIVE_SCAN_STOPPED, moduleId: expect.any(String) })
  })
})
