'use client'

import { clockTextOf, DayPhase, dayPhaseOf, GameTimeConfig } from '@lib/utils/game-time'
import { useGameTimeCurrentQuery } from '../../shared/api'
import { useServerClock } from '../factory/useServerClock'

export interface GameTime {
  // "HH:MM" of the in-game time
  clock: string
  phase: DayPhase
}

// The in-game time, derived from the server's instant and the day/night config it sends (design §12.5.1), so every player
// sees the same time; undefined until the server has said it
export function useGameTime(): GameTime | undefined {
  const { data } = useGameTimeCurrentQuery()
  const now = useServerClock(data?.now)

  if (now === undefined || !data?.config) {
    return undefined
  }
  const config = data.config as GameTimeConfig

  return { clock: clockTextOf(now, config), phase: dayPhaseOf(now, config) }
}
