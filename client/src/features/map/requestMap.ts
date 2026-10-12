import { IMapRange, IMapView } from '@lib/utils/interfaces/map'
import { GameSocket } from '../../shared/socket/socket-context'

// The socket's `get-map` as a promise
export function requestMap(socket: GameSocket, range: IMapRange): Promise<IMapView> {
  return new Promise((resolve, reject) => {
    socket.emit('get-map', range, (view, error) => (view ? resolve(view) : reject(error)))
  })
}
