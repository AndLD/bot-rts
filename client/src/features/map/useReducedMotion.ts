'use client'

import { useSettingsGetQuery } from '../../shared/api'
import { useSystemReducedMotion } from './useSystemReducedMotion'

// Whether movement and effects are replaced by instant changes (design §15.2): the player's own setting, and while they have
// none the setting of their system
export function useReducedMotion(): boolean {
  const { data } = useSettingsGetQuery()
  const isSystemReduced = useSystemReducedMotion()

  return data?.user.reducedMotion ?? isSystemReduced
}
