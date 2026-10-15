import { DEFAULT_GAME_TIME_SETTINGS, configOf } from '../../../../lib/utils/game-time'
import { FakeClock } from '../../../tests/fakes/fakes'
import { GameTimeState } from '../../shared/application/game-clock'
import { GameTimeService } from './game-time.service'

describe('GameTimeService', () => {
  it('tells the server game instant and the day/night config in force', async () => {
    const clock = new FakeClock(new Date(123456))
    const state = new GameTimeState(clock, false)
    const service = new GameTimeService(state.clock, state)

    expect(await service.current()).toEqual({ now: 123456, config: configOf(DEFAULT_GAME_TIME_SETTINGS) })

    state.apply({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 120_000, anchorMs: 9 })
    expect((await service.current()).config).toMatchObject({ dayLengthMs: 120_000, anchorMs: 9 })
  })

  it('reads the settings again before it answers', async () => {
    const clock = new FakeClock(new Date(1))
    const state = new GameTimeState(clock, false)
    const settings = { refresh: jest.fn(async () => state.apply({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs: 1000 })) }
    const service = new GameTimeService(state.clock, state, settings)

    expect((await service.current()).now).toBe(1001)
    expect(settings.refresh).toHaveBeenCalledTimes(1)
  })
})
