import {
  clockTextOf,
  configOf,
  DAY_LENGTH_MAX_MS,
  DAY_LENGTH_MIN_MS,
  DEFAULT_GAME_TIME_SETTINGS,
  gameTimeProblems,
  isValidTimeZone,
  DAY_PHASE,
  DEFAULT_GAME_TIME,
  dayPhaseOf,
  hourOf,
  sunlightOf
} from '../../../../lib/utils/game-time'

const HOUR_MS = DEFAULT_GAME_TIME.dayLengthMs / DEFAULT_GAME_TIME.hoursPerDay
const at = (hour: number) => hour * HOUR_MS

describe('the game clock', () => {
  it('counts an in-game hour as one real minute and repeats every day, also before the epoch', () => {
    expect(HOUR_MS).toBe(60_000)
    expect(hourOf(0)).toBe(0)
    expect(hourOf(at(13.5))).toBe(13.5)
    expect(hourOf(at(24 + 3))).toBe(3)
    expect(hourOf(-at(1))).toBe(23)
  })

  it('names the part of the day, with night on both sides of midnight', () => {
    const phases = [0, 4.9, 5, 8.9, 9, 16.9, 17, 20.9, 21, 23.9].map((hour) => dayPhaseOf(at(hour)))

    expect(phases).toEqual([
      DAY_PHASE.NIGHT,
      DAY_PHASE.NIGHT,
      DAY_PHASE.MORNING,
      DAY_PHASE.MORNING,
      DAY_PHASE.DAY,
      DAY_PHASE.DAY,
      DAY_PHASE.EVENING,
      DAY_PHASE.EVENING,
      DAY_PHASE.NIGHT,
      DAY_PHASE.NIGHT
    ])
  })

  it('gives the sunlight of the part of the day, about 0.57 on average', () => {
    expect([2, 7, 12, 19, 22].map((hour) => sunlightOf(at(hour)))).toEqual([0.1, 0.6, 1, 0.6, 0.1])

    const steps = 24 * 60
    const average = Array.from({ length: steps }, (_, i) => sunlightOf((i * DEFAULT_GAME_TIME.dayLengthMs) / steps))
    expect(average.reduce((sum, value) => sum + value, 0) / steps).toBeCloseTo(0.567, 2)
  })

  it('reads a custom config', () => {
    const config = { dayLengthMs: 1000, hoursPerDay: 10, spans: [{ phase: DAY_PHASE.DAY, fromHour: 0, sunlight: 1 }] }

    expect(hourOf(500, config)).toBe(5)
    expect(dayPhaseOf(500, config)).toBe(DAY_PHASE.DAY)
    expect(sunlightOf(999, config)).toBe(1)
  })

  it('formats the time as HH:MM', () => {
    expect(clockTextOf(0)).toBe('00:00')
    expect(clockTextOf(at(9.5))).toBe('09:30')
    expect(clockTextOf(at(23.99))).toBe('23:59')
  })
})

describe('the anchor of the day', () => {
  it('moves the time of day without changing the length of the day', () => {
    const config = { ...DEFAULT_GAME_TIME, anchorMs: at(5) }

    expect(hourOf(at(5), config)).toBe(0)
    expect(hourOf(at(5 + 16.5), config)).toBe(16.5)
    expect(hourOf(at(4), config)).toBe(23)
  })

  it('sets the time of day at an instant: the anchor is the instant minus the hours into the day', () => {
    const instant = 1_900_000_000_000
    const length = 48 * 60_000
    const anchorMs = instant - (16.5 / 24) * length
    const config = { ...DEFAULT_GAME_TIME, dayLengthMs: length, anchorMs }

    expect(clockTextOf(instant, config)).toBe('16:30')
    expect(clockTextOf(instant + length / 48, config)).toBe('17:00')
  })

  it('keeps the time of day when the day length changes, and goes on at the new speed', () => {
    const instant = 1_900_000_000_000
    const before = { ...DEFAULT_GAME_TIME, anchorMs: 0 }
    const hour = hourOf(instant, before)
    const length = 6.5 * 3_600_000
    const after = { ...before, dayLengthMs: length, anchorMs: instant - (hour / 24) * length }

    expect(hourOf(instant, after)).toBeCloseTo(hour, 9)
    expect(hourOf(instant + length / 24, after)).toBeCloseTo((hour + 1) % 24, 9)
  })
})

describe('the real-world mode', () => {
  const kyiv = { ...DEFAULT_GAME_TIME, timeZone: 'Europe/Kyiv' }

  it('shows the local time of the zone, with seconds as a fraction', () => {
    // 2026-01-15 10:00:30 UTC is 12:00:30 in Kyiv (UTC+2 in winter)
    const winter = Date.UTC(2026, 0, 15, 10, 0, 30, 500)
    // 2026-07-15 10:00:00 UTC is 13:00 in Kyiv (UTC+3 in summer)
    const summer = Date.UTC(2026, 6, 15, 10, 0, 0)

    expect(hourOf(winter, kyiv)).toBeCloseTo(12 + 30.5 / 3600, 9)
    expect(clockTextOf(summer, kyiv)).toBe('13:00')
    expect(dayPhaseOf(summer, kyiv)).toBe(DAY_PHASE.DAY)
  })

  it('follows the daylight-saving change of the zone: the clock jumps an hour at the change', () => {
    // Europe/Kyiv springs forward on 2026-03-29 at 01:00 UTC (03:00 becomes 04:00)
    const before = Date.UTC(2026, 2, 29, 0, 59, 0)
    const after = Date.UTC(2026, 2, 29, 1, 1, 0)

    expect(clockTextOf(before, kyiv)).toBe('02:59')
    expect(clockTextOf(after, kyiv)).toBe('04:01')
  })

  it('knows the zones that exist', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(5)).toBe(false)
  })
})

describe('the settings of the game time', () => {
  it('make the config of the mode', () => {
    expect(configOf(DEFAULT_GAME_TIME_SETTINGS)).toEqual({ ...DEFAULT_GAME_TIME, anchorMs: 0 })
    expect(configOf({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 60_000, anchorMs: 5 })).toMatchObject({
      dayLengthMs: 60_000,
      anchorMs: 5
    })
    expect(configOf({ ...DEFAULT_GAME_TIME_SETTINGS, mode: 'realWorld', timeZone: 'Europe/Kyiv' }).timeZone).toBe(
      'Europe/Kyiv'
    )
    // A real-world mode without a zone falls back to the cycle
    expect(configOf({ ...DEFAULT_GAME_TIME_SETTINGS, mode: 'realWorld' }).timeZone).toBeUndefined()
  })

  it('are checked: length, mode, zone, anchor and offset', () => {
    expect(gameTimeProblems(DEFAULT_GAME_TIME_SETTINGS)).toEqual([])
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: DAY_LENGTH_MIN_MS })).toEqual([])
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: DAY_LENGTH_MAX_MS })).toEqual([])
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: DAY_LENGTH_MIN_MS - 1 })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: DAY_LENGTH_MAX_MS + 1 })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, dayLengthMs: 1.5 * 60_000 + 0.5 })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, mode: 'sometimes' })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, mode: 'realWorld', timeZone: 'Nowhere' })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, mode: 'realWorld', timeZone: 'Europe/Kyiv' })).toEqual([])
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, anchorMs: Number.NaN })).toHaveLength(1)
    expect(gameTimeProblems({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs: -1 })).toHaveLength(1)
    expect(gameTimeProblems({})).toHaveLength(4)
  })
})
