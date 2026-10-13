// The game clock and the day/night cycle (design §12.4). Pure functions of a timestamp and a typed config: no
// `Date.now()`, so the engine (injected clock) and the client (server-synced clock) derive the same time.

export const DAY_PHASE = {
  NIGHT: 'night',
  MORNING: 'morning',
  DAY: 'day',
  EVENING: 'evening'
} as const

export type DayPhase = (typeof DAY_PHASE)[keyof typeof DAY_PHASE]

// A part of the day from `fromHour` (inclusive) to the start of the next part; the first part must start at hour 0
export interface DayPhaseSpan {
  phase: DayPhase
  fromHour: number
  // How much sun reaches the panels in this phase, from 0 to 1
  sunlight: number
}

export interface GameTimeConfig {
  // One in-game day in real milliseconds (the world clock counts from the Unix epoch)
  dayLengthMs: number
  hoursPerDay: number
  // The parts of the day in order of `fromHour`; the last one lasts until the day ends
  spans: readonly DayPhaseSpan[]
}

// Night wraps around midnight: it is the first span (00:00-05:00) and the last (21:00-24:00)
export const DEFAULT_GAME_TIME: GameTimeConfig = {
  dayLengthMs: 24 * 60 * 1000,
  hoursPerDay: 24,
  spans: [
    { phase: DAY_PHASE.NIGHT, fromHour: 0, sunlight: 0.1 },
    { phase: DAY_PHASE.MORNING, fromHour: 5, sunlight: 0.6 },
    { phase: DAY_PHASE.DAY, fromHour: 9, sunlight: 1 },
    { phase: DAY_PHASE.EVENING, fromHour: 17, sunlight: 0.6 },
    { phase: DAY_PHASE.NIGHT, fromHour: 21, sunlight: 0.1 }
  ]
}

// The in-game hour of a timestamp, from 0 (inclusive) to `hoursPerDay` (exclusive), with its fraction
export function hourOf(timestampMs: number, config: GameTimeConfig = DEFAULT_GAME_TIME): number {
  const intoDay = ((timestampMs % config.dayLengthMs) + config.dayLengthMs) % config.dayLengthMs
  return (intoDay / config.dayLengthMs) * config.hoursPerDay
}

function spanOf(timestampMs: number, config: GameTimeConfig): DayPhaseSpan {
  const hour = hourOf(timestampMs, config)
  return [...config.spans].reverse().find((span) => hour >= span.fromHour) ?? config.spans[0]
}

export function dayPhaseOf(timestampMs: number, config: GameTimeConfig = DEFAULT_GAME_TIME): DayPhase {
  return spanOf(timestampMs, config).phase
}

// 0 (no sun) to 1 (full sun): what a solar panel's output is scaled by
export function sunlightOf(timestampMs: number, config: GameTimeConfig = DEFAULT_GAME_TIME): number {
  return spanOf(timestampMs, config).sunlight
}

// "HH:MM" of the in-game time
export function clockTextOf(timestampMs: number, config: GameTimeConfig = DEFAULT_GAME_TIME): string {
  const hour = hourOf(timestampMs, config)
  const whole = Math.floor(hour)
  const minutes = Math.floor((hour - whole) * 60)
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
