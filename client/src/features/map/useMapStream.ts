import { useEffect, useMemo } from 'react'
import { useSocket } from '../../shared/socket/socket-context'
import { MapStore } from './MapStore'
import { requestMap } from './requestMap'
import { TileLoader } from './TileLoader'

// Keeps a MapStore filled from the socket: the map requests (through the tile loader) and the pushed changes
export function useMapStream() {
  const socket = useSocket()
  const store = useMemo(() => new MapStore(), [])
  const loader = useMemo(
    () => new TileLoader((range) => (socket ? requestMap(socket, range) : Promise.reject(new Error('offline'))), store),
    [socket, store]
  )

  useEffect(() => {
    if (!socket) {
      return
    }

    const onCells = (update: Parameters<typeof store.apply>[0]) => store.apply(update)
    const onAreas = (areas: Parameters<typeof store.setLiveAreas>[0]) => store.setLiveAreas(areas)
    const onRadio = (changes: Parameters<typeof store.setRadio>[0]) => store.setRadio(changes)
    // A scan adds knowledge the stream does not carry, and a reconnect may have missed pushes
    const onGameEvent = (event: { type: string }) => event.type === 'ScanCompleted' && loader.invalidate()
    const reload = () => loader.invalidate()

    socket.on('map-cells', onCells)
    socket.on('live-areas', onAreas)
    socket.on('radio-changes', onRadio)
    socket.on('game-event', onGameEvent)
    socket.on('connect', reload)

    return () => {
      socket.off('map-cells', onCells)
      socket.off('live-areas', onAreas)
      socket.off('radio-changes', onRadio)
      socket.off('game-event', onGameEvent)
      socket.off('connect', reload)
    }
  }, [socket, store, loader])

  return { store, loader }
}
