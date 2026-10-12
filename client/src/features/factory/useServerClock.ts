'use client'

import { useEffect, useState } from 'react'

// The time of the game server in ms, counted on from the last time it said what the time was
export function useServerClock(serverNow: number | undefined, intervalMs = 1000): number | undefined {
  const [offset, setOffset] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (serverNow !== undefined) {
      setOffset(serverNow - Date.now())
    }
  }, [serverNow])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs])

  return offset === null ? undefined : now + offset
}
