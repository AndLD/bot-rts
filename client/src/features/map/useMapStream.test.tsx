import { act, renderHook } from '@testing-library/react'
import { EventEmitter } from 'events'
import { ReactNode } from 'react'
import { SocketContext } from '../../shared/socket/socket-context'
import { useMapStream } from './useMapStream'

function fakeSocket() {
  const emitter = new EventEmitter()

  return Object.assign(emitter, {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: jest.fn((event: string, ...args: unknown[]) => {
      if (event === 'get-map') {
        const ack = args[1] as (view: unknown) => void
        ack({ now: 1, cells: [], liveAreas: [] })
      }
      return true
    })
  })
}

const wrapperFor = (socket: unknown) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <SocketContext.Provider value={socket as never}>{children}</SocketContext.Provider>
  }

describe('useMapStream', () => {
  it('feeds the store from the socket', () => {
    const socket = fakeSocket()
    const { result } = renderHook(() => useMapStream(), { wrapper: wrapperFor(socket) })
    const cell = { x: 1, y: 1, type: null, contentId: null, seenAt: 1 }

    act(() => void socket.listeners('map-cells')[0]({ now: 1, cells: [cell] }))
    expect(result.current.store.getCell(1, 1)).toBeDefined()

    act(() => void socket.listeners('live-areas')[0]([{ scannerId: 's', botId: 'b', x: 1, y: 1, radius: 0 }]))
    expect(result.current.store.getCell(1, 1)?.isLive).toBe(true)

    act(() => void socket.listeners('radio-changes')[0]([{ botId: 'b', isConnected: true, bars: 1, hops: 1 }]))
  })

  it('asks for the tiles again after a reconnect and after a scan, not after other events', () => {
    const socket = fakeSocket()
    const { result } = renderHook(() => useMapStream(), { wrapper: wrapperFor(socket) })
    const invalidate = jest.spyOn(result.current.loader, 'invalidate')

    socket.listeners('connect')[0]()
    socket.listeners('game-event')[0]({ type: 'BotMoved' })
    expect(invalidate).toHaveBeenCalledTimes(1)

    socket.listeners('game-event')[0]({ type: 'ScanCompleted' })
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('requests the map through the socket, and fails while there is none', async () => {
    const socket = fakeSocket()
    const { result } = renderHook(() => useMapStream(), { wrapper: wrapperFor(socket) })
    await result.current.loader.ensure({ minX: 0, minY: 0, maxX: 1, maxY: 1 })
    expect(socket.emit).toHaveBeenCalledWith('get-map', expect.any(Object), expect.any(Function))

    const offline = renderHook(() => useMapStream(), { wrapper: wrapperFor(null) })
    await expect(offline.result.current.loader.ensure({ minX: 0, minY: 0, maxX: 1, maxY: 1 })).resolves.toBeUndefined()
  })

  it('stops listening when it goes away', () => {
    const socket = fakeSocket()
    const { unmount } = renderHook(() => useMapStream(), { wrapper: wrapperFor(socket) })

    unmount()

    expect(socket.listenerCount('map-cells')).toBe(0)
    expect(socket.listenerCount('connect')).toBe(0)
  })
})
