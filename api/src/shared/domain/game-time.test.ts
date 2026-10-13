import {
  clockTextOf,
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
