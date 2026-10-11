import { buildModule } from '../../../tests/integration/builders'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import {
  ArmorModule,
  BatteryModule,
  DEFAULT_DRIVE_QUOTA_BYTES,
  DriveModule,
  EngineModule,
  GeneratorModule,
  GpsModule,
  ManipulatorModule,
  MiningModule,
  MovementModule,
  ProcessorModule,
  StorageModule,
  WirelessAdapterModule
} from './game-module'
import { ScannerModule } from './scanner-module'
import { WeaponModule } from './weapon-module'

const of = <T>(
  moduleClass: new (record: ReturnType<typeof buildModule>) => T,
  props: Record<string, unknown>,
  o = {}
) => new moduleClass(buildModule('bot', { props, ...o }))

describe('GameModule', () => {
  it('exposes the stored record and whether the module works', () => {
    const module = of(ScannerModule, {}, { id: 'm1', botId: 'b1', type: 'scanner', name: 'scanner-class1' })

    expect(module).toMatchObject({ id: 'm1', botId: 'b1', type: 'scanner', name: 'scanner-class1', isWorking: true })
    expect(of(ScannerModule, {}, { condition: 0 }).isWorking).toBe(false)
  })

  it('reads typed properties, with a fallback for missing or unusable values', () => {
    expect(of(ScannerModule, { distance: 3, delay: 250 })).toMatchObject({ distance: 3, delay: 250 })
    expect(of(ScannerModule, { distance: '4' }).distance).toBe(4)
    expect(of(ScannerModule, {})).toMatchObject({ distance: 0, delay: 0 })
    expect(of(ScannerModule, { distance: 'far' }).distance).toBe(0)
    expect(of(ScannerModule, { distance: -2 }).distance).toBe(0)
  })

  it('knows the drive, processor, adapter, weapon, battery and storage properties', () => {
    expect(of(DriveModule, { quota: 10, readDelay: 1, writeDelay: 2 })).toMatchObject({
      quota: 10,
      readDelay: 1,
      writeDelay: 2
    })
    expect(of(DriveModule, {})).toMatchObject({ quota: DEFAULT_DRIVE_QUOTA_BYTES, readDelay: 0, writeDelay: 0 })
    expect(of(ProcessorModule, { opsPerTick: 2, parallelExecutions: 3 })).toMatchObject({
      opsPerTick: 2,
      parallelExecutions: 3
    })
    expect(of(ProcessorModule, {})).toMatchObject({ opsPerTick: 1, parallelExecutions: 1 })
    expect(of(WirelessAdapterModule, { range: 20 }).range).toBe(20)
    expect(of(WeaponModule, { damage: 50, distance: 5 })).toMatchObject({ damage: 50, distance: 5 })
    expect(of(BatteryModule, { capacity: 3000, value: 10 })).toMatchObject({ capacity: 3000, value: 10 })
    expect(of(StorageModule, { capacity: 200 }).capacity).toBe(200)
  })
})

describe('the behaviour of the module types', () => {
  it('refuses actions of a broken module', () => {
    expect(of(ScannerModule, {}).ensureWorking()).toEqual({ ok: true, data: undefined })
    expect(of(ScannerModule, {}, { condition: 0, name: 'scanner-class1' }).ensureWorking()).toEqual({
      ok: false,
      code: 'BROKEN_MODULE',
      msg: 'The module scanner-class1 is broken'
    })
  })

  it('reads flags and texts with a fallback', () => {
    expect(of(WirelessAdapterModule, { isConnected: true, range: 3 })).toMatchObject({
      isConnected: true,
      isOnline: true
    })
    expect(of(WirelessAdapterModule, {})).toMatchObject({ isConnected: false, isOnline: false })
    expect(of(WirelessAdapterModule, { isConnected: true }, { condition: 0 }).isOnline).toBe(false)
    expect(of(ArmorModule, { material: 'iron', protection: 10 })).toMatchObject({ material: 'iron', protection: 10 })
    expect(of(ArmorModule, { material: 5 }).material).toBe('')
    expect(
      of(GeneratorModule, { isEnabled: true, delay: 250, energyPerCycle: 12, fuelPerCycle: 0.02, lastCycleAt: 500 })
    ).toMatchObject({
      isEnabled: true,
      delay: 250,
      energyPerCycle: 12,
      fuelPerCycle: 0.02,
      lastCycleAt: 500
    })
    expect(of(GeneratorModule, {})).toMatchObject({ isEnabled: false, delay: 0, energyPerCycle: 0, fuelPerCycle: 0 })
    expect(of(GeneratorModule, {}).lastCycleAt).toBeUndefined()
    expect(of(GeneratorModule, {}).enable(900)).toEqual({
      ok: true,
      data: { patch: { isEnabled: true, lastCycleAt: 900 } }
    })
    expect(of(GeneratorModule, {}, { condition: 0 }).enable(0)).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(of(GeneratorModule, { isEnabled: true }, { condition: 0 }).disable()).toEqual({
      patch: { isEnabled: false }
    })
    expect(of(ProcessorModule, { delay: 250 }).delay).toBe(250)
  })

  it('knows the movement, mining and handling properties', () => {
    expect(of(EngineModule, { engineType: 'fuel', speed: 50 })).toMatchObject({ engineType: 'fuel', speed: 50 })
    expect(of(EngineModule, { engineType: 'warp' }).engineType).toBe('electric')
    expect(of(EngineModule, {}).speed).toBe(0)
    expect(of(MovementModule, { loadCapacity: 400 }).loadCapacity).toBe(400)
    expect(of(ManipulatorModule, { loadCapacity: 50 }).loadCapacity).toBe(50)
    expect(of(MiningModule, { materialPerOperation: 5, strength: 2 })).toMatchObject({
      materialPerOperation: 5,
      strength: 2
    })
    expect(of(GpsModule, {}).isWorking).toBe(true)
  })

  it('draws energy from a battery without going below zero or above the capacity', () => {
    const battery = of(BatteryModule, { capacity: 100, value: 40, voltage: 12 })

    expect(battery).toMatchObject({ voltage: 12, isConnected: true })
    expect(battery.discharge(15)).toEqual({ ok: true, data: 25 })
    expect(battery.discharge(41)).toMatchObject({ ok: false, code: 'NO_ENERGY' })
    expect(battery.charge(30)).toBe(70)
    expect(battery.charge(1000)).toBe(100)
    expect(of(BatteryModule, { capacity: 100, value: 500 }).value).toBe(100)
    expect(of(BatteryModule, { capacity: 100, value: 40 }, { condition: 0 }).discharge(1)).toMatchObject({
      code: 'BROKEN_MODULE'
    })
    expect(of(BatteryModule, { isConnected: false }).isConnected).toBe(false)
  })

  it('puts resources into a storage and takes them out again', () => {
    const storage = of(StorageModule, {
      capacity: 10,
      items: [
        { resource: 'oil', amount: 4 },
        { resource: 'x', amount: 1 }
      ]
    })

    expect(storage.items).toEqual([{ resource: 'oil', amount: 4 }])
    expect(storage).toMatchObject({ used: 4, free: 6 })
    expect(storage.amountOf(RESOURCE.OIL)).toBe(4)
    expect(storage.amountOf(RESOURCE.GOLD)).toBe(0)

    expect(storage.add({ resource: RESOURCE.IRON, amount: 6 })).toEqual({
      ok: true,
      data: [
        { resource: 'oil', amount: 4 },
        { resource: 'iron', amount: 6 }
      ]
    })
    expect(storage.add({ resource: RESOURCE.IRON, amount: 7 })).toMatchObject({ code: 'NO_SPACE' })
    expect(storage.remove({ resource: RESOURCE.OIL, amount: 4 })).toEqual({ ok: true, data: [] })
    expect(storage.remove({ resource: RESOURCE.OIL, amount: 5 })).toMatchObject({ code: 'EMPTY' })
  })

  it('holds nothing when the stored items are not a list, and refuses work when broken', () => {
    expect(of(StorageModule, { capacity: 10, items: 'junk' }).items).toEqual([])
    expect(of(StorageModule, { capacity: 10, items: [null] }).items).toEqual([])
    const broken = of(StorageModule, { capacity: 10 }, { condition: 0 })
    expect(broken.add({ resource: RESOURCE.OIL, amount: 1 })).toMatchObject({ code: 'BROKEN_MODULE' })
    expect(broken.remove({ resource: RESOURCE.OIL, amount: 1 })).toMatchObject({ code: 'BROKEN_MODULE' })
  })

  it('lets a drill take what one operation allows from a deposit it is strong enough for', () => {
    const drill = of(MiningModule, { materialPerOperation: 5, strength: 2 })

    expect(drill.extract({ resource: RESOURCE.IRON, amount: 80 }, 2)).toEqual({
      ok: true,
      data: { resource: 'iron', amount: 5 }
    })
    expect(drill.extract({ resource: RESOURCE.IRON, amount: 3 }, 2)).toMatchObject({ data: { amount: 3 } })
    expect(drill.extract({ resource: RESOURCE.GOLD, amount: 10 }, 3)).toMatchObject({ code: 'TOO_LOW' })
    expect(drill.extract({ resource: RESOURCE.IRON, amount: 0 }, 2)).toMatchObject({ code: 'EMPTY' })
    expect(
      of(MiningModule, { materialPerOperation: 5, strength: 2 }, { condition: 0 }).extract(
        { resource: RESOURCE.IRON, amount: 9 },
        1
      )
    ).toMatchObject({ code: 'BROKEN_MODULE' })
  })
})
