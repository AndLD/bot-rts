import { readWorldConfig } from './world-config.reader'

describe('readWorldConfig', () => {
  it('uses the defaults for an empty environment', () => {
    expect(readWorldConfig({})).toEqual({ resourceChance: 0.2, spawnMaxDistance: 10, spawnAttempts: 20 })
  })

  it('reads overrides', () => {
    expect(
      readWorldConfig({ WORLD_RESOURCE_CHANCE: '0.5', WORLD_SPAWN_MAX_DISTANCE: '50', WORLD_SPAWN_ATTEMPTS: '3' })
    ).toEqual({ resourceChance: 0.5, spawnMaxDistance: 50, spawnAttempts: 3 })
  })

  it('falls back on garbage and clamps the chance and attempts', () => {
    expect(
      readWorldConfig({ WORLD_RESOURCE_CHANCE: '7', WORLD_SPAWN_MAX_DISTANCE: 'far', WORLD_SPAWN_ATTEMPTS: '0' })
    ).toEqual({ resourceChance: 1, spawnMaxDistance: 10, spawnAttempts: 1 })
    expect(readWorldConfig({ WORLD_RESOURCE_CHANCE: '', WORLD_SPAWN_ATTEMPTS: '-4' }).spawnAttempts).toBe(20)
  })
})
