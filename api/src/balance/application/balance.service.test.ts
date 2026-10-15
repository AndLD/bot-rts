import { IBalanceDocument } from '../../../../lib/utils/admin-balance'
import { FakeClock } from '../../../tests/fakes/fakes'
import { DEFAULT_CRAFTING_CONFIG } from '../../crafting/domain/crafting-config'
import { DEFAULT_WORLD_CONFIG } from '../../map/domain/world-config'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { BalanceConfig } from '../domain/balance'
import { BalanceService } from './balance.service'
import { BalanceRepository, BalanceVersionRecord } from './ports'

const base: BalanceConfig = { resources: DEFAULT_WORLD_CONFIG.resources, crafting: DEFAULT_CRAFTING_CONFIG }

class MemoryVersions implements BalanceRepository {
  records: BalanceVersionRecord[] = []
  active: number | null = null

  async list() {
    return [...this.records].reverse()
  }
  async find(version: number) {
    return this.records.find((record) => record.version === version) ?? null
  }
  async addAndActivate(input: Omit<BalanceVersionRecord, 'version'>) {
    const record = { ...input, version: this.records.length + 1 }
    this.records.push(record)
    this.active = record.version
    return record
  }
  async activeVersion() {
    return this.active
  }
}

function setup(problem: string | null = null) {
  const versions = new MemoryVersions()
  const clock = new FakeClock()
  return { versions, service: new BalanceService(versions, base, 1, problem, clock), clock }
}

const cheap: IBalanceDocument = { recipes: { 'gun-class1': { craftTimeMs: 1 } } }

describe('BalanceService', () => {
  it('shows the defaults when no version was stored', async () => {
    const { service } = setup('Version 4: broken')

    const state = await service.state()

    expect(state).toMatchObject({
      activeVersion: null,
      runningVersion: 1,
      problem: 'Version 4: broken',
      documentJson: '{}',
      versions: []
    })
    expect(state.effective).toContainEqual({ path: 'recipes.gun-class1.craftTimeMs', value: '20000' })
  })

  it('stores a valid document as the active version and says what it changed', async () => {
    const { service, clock } = setup()

    const change = await service.save('admin', cheap, 'faster guns')

    expect(change.before).toEqual({ version: null })
    expect(change.after).toEqual({
      version: 1,
      changes: [{ path: 'recipes.gun-class1.craftTimeMs', from: '20000', to: '1' }]
    })
    const state = await service.state()
    expect(state.activeVersion).toBe(1)
    expect(state.versions).toEqual([
      { version: 1, reason: 'faster guns', createdBy: 'admin', createdAt: clock.now().getTime(), isActive: true }
    ])
    expect(JSON.parse(state.documentJson)).toEqual(cheap)
    expect(state.effective).toContainEqual({ path: 'recipes.gun-class1.craftTimeMs', value: '1' })
  })

  it('refuses an invalid document and stores nothing', async () => {
    const { service, versions } = setup()

    await expect(service.save('admin', { resources: { iron: { minAmount: 9_999_999 } } }, 'x')).rejects.toBeInstanceOf(
      ValidationError
    )
    expect(versions.records).toHaveLength(0)
  })

  it('previews against the active version, and lists the problems of an invalid document with no changes', async () => {
    const { service } = setup()
    await service.save('admin', cheap, 'faster guns')

    expect(await service.preview({ recipes: { 'gun-class1': { craftTimeMs: 1 } } })).toEqual({
      problems: [],
      changes: []
    })
    expect((await service.preview({ recipes: { 'gun-class1': { craftTimeMs: 2 } } })).changes).toEqual([
      { path: 'recipes.gun-class1.craftTimeMs', from: '1', to: '2' }
    ])
    expect(await service.preview({ nonsense: 1 })).toEqual({ problems: ['nonsense: unknown section'], changes: [] })
  })

  it('rolls back by storing the document of an older version as a new one', async () => {
    const { service, versions } = setup()
    await service.save('admin', cheap, 'faster guns')
    await service.save('admin', {}, 'defaults')

    const change = await service.rollback('owner', 1, 'oops')

    expect(change.before).toEqual({ version: 2 })
    expect(versions.records).toHaveLength(3)
    expect(versions.records[2]).toMatchObject({
      document: cheap,
      reason: 'Rollback to version 1: oops',
      createdBy: 'owner'
    })
    expect(await service.versionDocument(2)).toBe('{}')
  })

  it('does not know a version that was never stored', async () => {
    const { service } = setup()

    await expect(service.versionDocument(9)).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.rollback('owner', 9, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})
