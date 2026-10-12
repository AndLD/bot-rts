'use client'

import { useEffect } from 'react'
import { useBotsListQuery, useMapPositionQuery } from '../../shared/api'
import MapCanvas from './MapCanvas'
import { useReducedMotion } from './useReducedMotion'
import { useMapStream } from './useMapStream'

// The player's map, opened on their base
export default function GameMap({ baseId, onOpenBot }: { baseId: string; onOpenBot?: (botId: string) => void }) {
  const { store, loader } = useMapStream()
  const { data: position } = useMapPositionQuery({ botId: baseId })
  const { data: bots } = useBotsListQuery({})
  const botCount = bots?.length
  const isReducedMotion = useReducedMotion()

  // A bot that was assembled or lost is on the map or gone from it, which the stream does not tell
  useEffect(() => {
    loader.invalidate()
  }, [botCount, loader])

  return (
    <MapCanvas
      store={store}
      loader={loader}
      center={position}
      onOpenBot={onOpenBot}
      isReducedMotion={isReducedMotion}
    />
  )
}
