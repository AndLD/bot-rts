'use client'

import { useEffect } from 'react'
import { useBotsListQuery, useMapPositionQuery } from '../../shared/api'
import MapCanvas from './MapCanvas'
import { useMapStream } from './useMapStream'

// The player's map, opened on their base
export default function GameMap({ baseId }: { baseId: string }) {
  const { store, loader } = useMapStream()
  const { data: position } = useMapPositionQuery({ botId: baseId })
  const { data: bots } = useBotsListQuery({})
  const botCount = bots?.length

  // A bot that was assembled or lost is on the map or gone from it, which the stream does not tell
  useEffect(() => {
    loader.invalidate()
  }, [botCount, loader])

  return <MapCanvas store={store} loader={loader} center={position} />
}
