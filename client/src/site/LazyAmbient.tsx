'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const AmbientCanvas = dynamic(() => import('../features/ambient/AmbientCanvas'), { ssr: false })

// How long the page is left alone after it loads, so the scene never competes with what the visitor came to read
export const AMBIENT_DELAY_MS = 1500

// The live scene of the hero, loaded after the page has settled (design §15.3): until then the static poster is all there is
export default function LazyAmbient() {
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), AMBIENT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [])

  return isReady ? <AmbientCanvas /> : null
}
