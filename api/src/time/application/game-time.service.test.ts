import { DEFAULT_GAME_TIME } from '../../../../lib/utils/game-time'
import { GameTimeService } from './game-time.service'

describe('GameTimeService', () => {
  it('tells the server instant and the day/night config', () => {
    const service = new GameTimeService({ now: () => new Date(123456) }, DEFAULT_GAME_TIME)

    expect(service.current()).toEqual({ now: 123456, config: DEFAULT_GAME_TIME })
  })
})
