import { DAY_PHASE, DayPhase } from '@lib/utils/game-time'

// How strongly the dark-blue night filter covers the map in each part of the day (design §4.5)
export const NIGHT_FILTER_OPACITY: Record<DayPhase, number> = {
  [DAY_PHASE.NIGHT]: 0.65,
  [DAY_PHASE.MORNING]: 0.25,
  [DAY_PHASE.DAY]: 0,
  [DAY_PHASE.EVENING]: 0.25
}

// A part of an in-game hour is a real minute: the filter fades over a good part of it, so dusk and dawn are gradual
export const NIGHT_FILTER_FADE_SECONDS = 20
