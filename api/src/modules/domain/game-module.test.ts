import { buildModule } from '../../../tests/integration/builders'
import {
  BatteryModule,
  DEFAULT_DRIVE_QUOTA_BYTES,
  DriveModule,
  ProcessorModule,
  ScannerModule,
  StorageModule,
  WeaponModule,
  WirelessAdapterModule
} from './game-module'

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
