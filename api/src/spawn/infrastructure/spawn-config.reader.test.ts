import { DEFAULT_SPAWN_CONFIG } from '../domain/spawn-config'
import { readSpawnConfig } from './spawn-config.reader'

describe('readSpawnConfig', () => {
  it('uses the defaults of the design for an empty environment', () => {
    expect(readSpawnConfig({})).toEqual(DEFAULT_SPAWN_CONFIG)
    expect(DEFAULT_SPAWN_CONFIG).toMatchObject({
      minBaseDistance: 30,
      seedRadius: 12,
      seedMaxPlayers: 8,
      seedTtlHours: 24
    })
  })

  it('reads every number', () => {
    expect(
      readSpawnConfig({
        WORLD_MIN_BASE_DISTANCE: '40',
        WORLD_SPAWN_ATTEMPTS: '9',
        WORLD_SPAWN_RADIUS: '100',
        WORLD_SPAWN_RADIUS_PER_BASE: '3',
        SPAWN_SEED_RADIUS: '5',
        SPAWN_SEED_MAX_PLAYERS: '2',
        SPAWN_SEED_TTL_HOURS: '1.9'
      })
    ).toEqual({
      minBaseDistance: 40,
      attempts: 9,
      radius: 100,
      radiusPerBase: 3,
      seedRadius: 5,
      seedMaxPlayers: 2,
      seedTtlHours: 1
    })
  })

  it('falls back on garbage, zero and negative numbers', () => {
    expect(
      readSpawnConfig({ WORLD_MIN_BASE_DISTANCE: 'far', WORLD_SPAWN_ATTEMPTS: '0', SPAWN_SEED_RADIUS: '-3' })
    ).toEqual(DEFAULT_SPAWN_CONFIG)
    expect(readSpawnConfig({ WORLD_SPAWN_RADIUS: '' })).toEqual(DEFAULT_SPAWN_CONFIG)
  })
})
