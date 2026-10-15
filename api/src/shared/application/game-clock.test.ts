import { DEFAULT_GAME_TIME_SETTINGS } from '../../../../lib/utils/game-time'
import { FakeClock } from '../../../tests/fakes/fakes'
import { GameTimeState } from './game-clock'

const settings = (offsetMs: number) => ({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs })

describe('GameTimeState', () => {
  it('starts as the real clock with the default day', () => {
    const real = new FakeClock()
    const state = new GameTimeState(real, false)

    expect(state.clock.now()).toEqual(real.now())
    expect(state.settings()).toEqual(DEFAULT_GAME_TIME_SETTINGS)
    expect(state.config().dayLengthMs).toBe(24 * 60 * 1000)
  })

  it('runs ahead of the real clock by the offset, and follows it afterwards', () => {
    const real = new FakeClock()
    const state = new GameTimeState(real, false)
    state.apply(settings(3_600_000))

    expect(state.clock.now().getTime()).toBe(real.now().getTime() + 3_600_000)
    real.current = new Date(real.current.getTime() + 1000)
    expect(state.clock.now().getTime()).toBe(real.now().getTime() + 3_600_000)
  })

  it('never goes back: a real clock that steps back does not move the game clock back', () => {
    const real = new FakeClock()
    const state = new GameTimeState(real, false)
    const first = state.clock.now().getTime()
    real.current = new Date(first - 5000)

    expect(state.clock.now().getTime()).toBe(first)
  })

  it('goes back only when a new setting lowers the offset on purpose (the reset of a test server)', () => {
    const real = new FakeClock()
    const state = new GameTimeState(real, false)
    state.apply(settings(10_000))
    expect(state.clock.now().getTime()).toBe(real.now().getTime() + 10_000)

    state.apply(settings(0))

    expect(state.clock.now().getTime()).toBe(real.now().getTime())
  })

  it('ignores the offset in production, whatever the settings say', () => {
    const real = new FakeClock()
    const state = new GameTimeState(real, true, settings(5_000))
    state.apply(settings(9_999_999))

    expect(state.offsetMs()).toBe(0)
    expect(state.clock.now()).toEqual(real.now())
    expect(state.settings().offsetMs).toBe(9_999_999)
  })

  it('hands out the config of the settings in force, not a copy taken at start', () => {
    const state = new GameTimeState(new FakeClock(), false)
    const before = state.config()

    state.apply({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 120_000, anchorMs: 7 })

    expect(before.dayLengthMs).toBe(24 * 60 * 1000)
    expect(state.config()).toMatchObject({ dayLengthMs: 120_000, anchorMs: 7 })
  })
})
