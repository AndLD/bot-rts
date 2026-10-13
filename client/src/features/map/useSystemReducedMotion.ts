'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const systemPrefers = () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true

// Whether the player's system asks for less motion; follows the system while the page is open
export function useSystemReducedMotion(): boolean {
  const [isReduced, setReduced] = useState(systemPrefers)

  useEffect(() => {
    const media = window.matchMedia?.(QUERY)
    if (!media) {
      return
    }
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)

    return () => media.removeEventListener('change', onChange)
  }, [])

  return isReduced
}
