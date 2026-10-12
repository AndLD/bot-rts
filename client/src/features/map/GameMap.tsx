'use client'

import { useMapPositionQuery } from '../../shared/api'
import MapCanvas from './MapCanvas'
import { useMapStream } from './useMapStream'

// The player's map, opened on their base
export default function GameMap({ baseId }: { baseId: string }) {
  const { store, loader } = useMapStream()
  const { data: position } = useMapPositionQuery({ botId: baseId })

  return <MapCanvas store={store} loader={loader} center={position} />
}
