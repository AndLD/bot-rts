import { clockTextOf, DEFAULT_GAME_TIME_SETTINGS } from '../../../../lib/utils/game-time'
import { FakeClock } from '../../../tests/fakes/fakes'
import { GameTimeState } from '../../shared/application/game-clock'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { GameTimeAdminService } from './game-time-admin.service'
import { GameTimeSettingsService, GameTimeStore } from './game-time-settings.service'

function setup(canAdvance = true) {
  const clock = new FakeClock(new Date(Date.UTC(2026, 5, 1, 12, 0, 0)))
  const state = new GameTimeState(clock, false)
  const store: GameTimeStore & { saved: unknown[] } = {
    saved: [],
    load: async () => ({ settings: state.settings(), updatedAt: null }),
    save: async (settings) => void store.saved.push(settings)
  }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const settings = new GameTimeSettingsService(store, state, clock, logger)

  return { clock, state, store, service: new GameTimeAdminService(settings, state, state.clock, canAdvance) }
}

describe('GameTimeAdminService', () => {
  it('shows the settings, the config in force, the game instant and whether the clock may be advanced', async () => {
    const { service, clock } = setup(false)

    expect(await service.view()).toMatchObject({
      settings: DEFAULT_GAME_TIME_SETTINGS,
      now: clock.now().getTime(),
      canAdvance: false
    })
  })

  it('sets the time of day at this instant, from 05:00 to 16:30', async () => {
    const { service, state, clock } = setup()

    await service.setTimeOfDay(5 * 60)
    expect(clockTextOf(clock.now().getTime(), state.config())).toBe('05:00')
    const { before, after } = await service.setTimeOfDay(16 * 60 + 30)

    expect(clockTextOf(clock.now().getTime(), state.config())).toBe('16:30')
    expect(after.anchorMs).not.toBe(before.anchorMs)
  })

  it.each([-1, 1440, 1.5, Number.NaN])('refuses the minute of the day %s', async (minute) => {
    await expect(setup().service.setTimeOfDay(minute)).rejects.toThrow(ValidationError)
  })

  it('changes the day length without a jump of the time of day', async () => {
    const { service, state, clock } = setup()
    await service.setTimeOfDay(7 * 60)
    const before = clockTextOf(clock.now().getTime(), state.config())

    await service.setDayLength(6.5 * 3_600_000)

    expect(clockTextOf(clock.now().getTime(), state.config())).toBe(before)
    expect(state.settings().dayLengthMs).toBe(6.5 * 3_600_000)
    await expect(service.setDayLength(10)).rejects.toThrow(ValidationError)
  })

  it('shows the time of a zone, refuses an unknown one, and goes back to the cycle at the same time of day', async () => {
    const { service, state, clock } = setup()

    await service.setRealWorld('Europe/Kyiv')
    expect(state.settings()).toMatchObject({ mode: 'realWorld', timeZone: 'Europe/Kyiv' })
    expect(clockTextOf(clock.now().getTime(), state.config())).toBe('15:00')
    await expect(service.setRealWorld('Mars/Olympus')).rejects.toThrow(ValidationError)

    await service.leaveRealWorld()
    expect(state.settings().mode).toBe('cycle')
    expect(clockTextOf(clock.now().getTime(), state.config())).toBe('15:00')
  })

  it('advances the clock by a step on a test server, only forward and only by the offered steps', async () => {
    const { service, state, clock } = setup()

    await service.advance(3_600_000)
    expect(state.clock.now().getTime()).toBe(clock.now().getTime() + 3_600_000)
    await service.advance(60_000)
    expect(state.settings().offsetMs).toBe(3_660_000)
    await expect(service.advance(5)).rejects.toThrow(ValidationError)
    await expect(service.advance(-60_000)).rejects.toThrow(ValidationError)
  })

  it('refuses to advance the clock where it is not a test server', async () => {
    await expect(setup(false).service.advance(60_000)).rejects.toThrow(ForbiddenError)
  })
})
