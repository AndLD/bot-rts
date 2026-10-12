'use client'

import { useEffect, useState } from 'react'
import { useSettingsGetQuery } from '../../shared/api'

const QUERY = '(prefers-reduced-motion: reduce)'

const systemPrefers = () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true

// Whether movement and effects are replaced by instant changes (design §15.2): the player's own setting, and while they have
// none the setting of their system
export function useReducedMotion(): boolean {
  const { data } = useSettingsGetQuery()
  const [isSystemReduced, setSystemReduced] = useState(systemPrefers)

  useEffect(() => {
    const media = window.matchMedia?.(QUERY)
    if (!media) {
      return
    }
    const onChange = () => setSystemReduced(media.matches)
    media.addEventListener('change', onChange)

    return () => media.removeEventListener('change', onChange)
  }, [])

  return data?.user.reducedMotion ?? isSystemReduced
}
