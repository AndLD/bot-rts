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
  // The instant (in game-clock milliseconds) at which the in-game time is 00:00; 0 when not set. Moving it sets the time of day
  // without moving anything else (design §25.3, Game time).
  anchorMs?: number
  // When set, the game shows the wall-clock time of this IANA time zone (a 24-hour day, daylight saving included) and the
  // day length and the anchor are not used
  timeZone?: string
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
  if (config.timeZone) {
    return zoneHourOf(timestampMs, config.timeZone)
  }
  const intoDay = mod(timestampMs - (config.anchorMs ?? 0), config.dayLengthMs)
  return (intoDay / config.dayLengthMs) * config.hoursPerDay
}

const mod = (value: number, by: number): number => ((value % by) + by) % by

const formatters = new Map<string, Intl.DateTimeFormat>()

// The hour of the day in a time zone, with its fraction: its own local time, so a daylight-saving day is 23 or 25 hours long
function zoneHourOf(timestampMs: number, timeZone: string): number {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
    formatters.set(timeZone, formatter)
  }
  const part = (type: string) =>
    Number(formatter.formatToParts(timestampMs).find((entry) => entry.type === type)?.value)

  return part('hour') + part('minute') / 60 + (part('second') + mod(timestampMs, 1000) / 1000) / 3600
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return true
  } catch {
    return false
  }
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
  // The tiny addition keeps a minute that floating-point division left just below its boundary (4.0166… h is 04:01)
  const totalMinutes = Math.floor(hourOf(timestampMs, config) * 60 + 1e-6)
  const whole = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// What an admin sets (design §25.3, Game time), stored in the game settings and followed by every process
export const DAY_LENGTH_MIN_MS = 60 * 1000
export const DAY_LENGTH_MAX_MS = 24 * 60 * 60 * 1000

export const GAME_TIME_MODES = ['cycle', 'realWorld'] as const

export type GameTimeMode = (typeof GAME_TIME_MODES)[number]

export interface GameTimeSettings {
  // The length of an in-game day in the `cycle` mode
  dayLengthMs: number
  mode: GameTimeMode
  // The zone of the `realWorld` mode
  timeZone: string | null
  // See `GameTimeConfig.anchorMs`
  anchorMs: number
  // How far the game clock is ahead of the real one: only a test server advances it, and production ignores it
  offsetMs: number
}

export const DEFAULT_GAME_TIME_SETTINGS: GameTimeSettings = {
  dayLengthMs: DEFAULT_GAME_TIME.dayLengthMs,
  mode: 'cycle',
  timeZone: null,
  anchorMs: 0,
  offsetMs: 0
}

// The config the time functions use for the settings
export function configOf(settings: GameTimeSettings): GameTimeConfig {
  return settings.mode === 'realWorld' && settings.timeZone
    ? { ...DEFAULT_GAME_TIME, timeZone: settings.timeZone }
    : { ...DEFAULT_GAME_TIME, dayLengthMs: settings.dayLengthMs, anchorMs: settings.anchorMs }
}

// What is wrong with the settings, in words; empty when they are fine
export function gameTimeProblems(settings: Partial<Record<keyof GameTimeSettings, unknown>>): string[] {
  const problems: string[] = []
  const { dayLengthMs, mode, timeZone, anchorMs, offsetMs } = settings

  if (
    typeof dayLengthMs !== 'number' ||
    !Number.isInteger(dayLengthMs) ||
    dayLengthMs < DAY_LENGTH_MIN_MS ||
    dayLengthMs > DAY_LENGTH_MAX_MS
  ) {
    problems.push('The day length must be a whole number of milliseconds from 1 minute to 24 hours')
  }
  if (!(GAME_TIME_MODES as readonly unknown[]).includes(mode)) {
    problems.push('The mode must be "cycle" or "realWorld"')
  }
  if (mode === 'realWorld' && !isValidTimeZone(timeZone)) {
    problems.push('The real-world mode needs a known IANA time zone, for example "Europe/Kyiv"')
  }
  if (typeof anchorMs !== 'number' || !Number.isFinite(anchorMs)) {
    problems.push('The anchor of the day must be a number')
  }
  if (typeof offsetMs !== 'number' || !Number.isFinite(offsetMs) || offsetMs < 0) {
    problems.push('The offset of the clock must be a number that is not negative')
  }

  return problems
}
