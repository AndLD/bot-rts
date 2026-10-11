import { BOT_REPOSITORY } from '../../bots/application/bot.repository'
import { FILE_REPOSITORY } from '../../files/application/file.repository'
import { MAP_REPOSITORY } from '../../map/application/map.repository'
import { MODULE_REPOSITORY } from '../../modules/application/module.repository'
import { PASSWORD_HASHER } from '../../auth/application/ports'
import { RNG } from '../../shared/application/rng'
import { CLOCK } from '../../shared/application/clock'
import { ID_GENERATOR } from '../../shared/application/id-generator'
import { USER_REPOSITORY } from '../../users/application/user.repository'
import { UNIT_OF_WORK } from './unit-of-work'
import { WORLD_STATE_STORE } from './world-state-store'

describe('port tokens', () => {
  it('are distinct symbols, so providers can never be mixed up', () => {
    const tokens = [
      USER_REPOSITORY,
      BOT_REPOSITORY,
      MODULE_REPOSITORY,
      FILE_REPOSITORY,
      MAP_REPOSITORY,
      UNIT_OF_WORK,
      WORLD_STATE_STORE,
      CLOCK,
      ID_GENERATOR,
      RNG,
      PASSWORD_HASHER
    ]

    expect(new Set(tokens).size).toBe(tokens.length)
    expect(tokens.every((token) => typeof token === 'symbol')).toBe(true)
  })
})
