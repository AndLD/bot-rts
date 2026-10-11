import { buildModule } from '../../../tests/integration/builders'
import { DEFAULT_DRIVE_QUOTA_BYTES, driveNames, isDrive, isWorking, quotaOf } from './drive'

const drive = (overrides = {}) => buildModule('bot', { type: 'drive', name: 'memory-class1', ...overrides })

describe('drive rules', () => {
  it('recognises memory modules', () => {
    expect(isDrive(drive())).toBe(true)
    expect(isDrive(buildModule('bot'))).toBe(false)
  })

  it('takes the quota from the module, with the class-1 size as the fallback', () => {
    expect(quotaOf(drive({ props: { quota: 1024 } }))).toBe(1024)
    expect(quotaOf(drive({ props: {} }))).toBe(DEFAULT_DRIVE_QUOTA_BYTES)
    expect(quotaOf(drive({ props: { quota: -5 } }))).toBe(DEFAULT_DRIVE_QUOTA_BYTES)
  })

  it('treats a module with no condition left as broken', () => {
    expect(isWorking(drive({ condition: 1 }))).toBe(true)
    expect(isWorking(drive({ condition: 0 }))).toBe(false)
  })

  it('numbers drives that share a name', () => {
    const [a, b, c] = [drive(), drive(), drive({ name: 'memory-class2' })]

    expect([...driveNames([a, b, c]).values()]).toEqual(['memory-class1', 'memory-class1-2', 'memory-class2'])
  })
})
