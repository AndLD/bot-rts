import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { DEFAULT_WORLD_CONFIG } from '../domain/world-config'
import { readWorldConfig } from './world-config.reader'

describe('readWorldConfig', () => {
  it('uses the defaults for an empty environment', () => {
    expect(readWorldConfig({})).toEqual(DEFAULT_WORLD_CONFIG)
    expect(DEFAULT_WORLD_CONFIG).toMatchObject({ resourceChance: 0.2, spawnMaxDistance: 10, spawnAttempts: 20 })
  })

  it('reads overrides', () => {
    expect(
      readWorldConfig({ WORLD_RESOURCE_CHANCE: '0.5', WORLD_SPAWN_MAX_DISTANCE: '50', WORLD_SPAWN_ATTEMPTS: '3' })
    ).toMatchObject({ resourceChance: 0.5, spawnMaxDistance: 50, spawnAttempts: 3 })
  })

  it('falls back on garbage and clamps the chance and attempts', () => {
    expect(
      readWorldConfig({ WORLD_RESOURCE_CHANCE: '7', WORLD_SPAWN_MAX_DISTANCE: 'far', WORLD_SPAWN_ATTEMPTS: '0' })
    ).toMatchObject({ resourceChance: 1, spawnMaxDistance: 10, spawnAttempts: 1 })
    expect(readWorldConfig({ WORLD_RESOURCE_CHANCE: '', WORLD_SPAWN_ATTEMPTS: '-4' }).spawnAttempts).toBe(20)
  })

  describe('the resource balance file', () => {
    const env = { WORLD_RESOURCE_BALANCE_FILE: 'balance.json' }

    it('overrides single fields of single resources and keeps the rest', () => {
      const problems: string[] = []
      const config = readWorldConfig(env, problems, () => JSON.stringify({ gold: { spawnWeight: 10, maxAmount: 99 } }))

      expect(problems).toEqual([])
      expect(config.resources[RESOURCE.GOLD]).toEqual({
        ...DEFAULT_RESOURCE_BALANCE.gold,
        spawnWeight: 10,
        maxAmount: 99
      })
      expect(config.resources[RESOURCE.IRON]).toEqual(DEFAULT_RESOURCE_BALANCE.iron)
    })

    it('reports an unreadable file and keeps the defaults', () => {
      const problems: string[] = []
      const config = readWorldConfig(env, problems, () => {
        throw new Error('ENOENT')
      })

      expect(problems).toEqual(['WORLD_RESOURCE_BALANCE_FILE balance.json must be a readable JSON file'])
      expect(config.resources).toEqual(DEFAULT_RESOURCE_BALANCE)
    })

    it('reports an invalid balance and keeps the defaults', () => {
      const problems: string[] = []
      const config = readWorldConfig(env, problems, () => JSON.stringify({ iron: { minAmount: 500 } }))

      expect(problems).toEqual(['WORLD_RESOURCE_BALANCE_FILE: iron: minAmount must not exceed maxAmount'])
      expect(config.resources).toEqual(DEFAULT_RESOURCE_BALANCE)
    })

    it('reads the file from disk by default', () => {
      const problems: string[] = []
      readWorldConfig({ WORLD_RESOURCE_BALANCE_FILE: __filename }, problems)

      expect(problems).toHaveLength(1)
    })
  })
})
