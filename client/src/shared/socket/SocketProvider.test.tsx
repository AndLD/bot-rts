import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'
import { act, render } from '@testing-library/react'
import { io } from 'socket.io-client'
import { Provider } from 'react-redux'
import { createFakeAuth } from '../../../tests/render'
import { AuthClientContext } from '../../features/auth/auth-client-context'
import { API_TAGS } from '../api/empty-api'
import { setupStore } from '../store'
import { setToken } from '../store/session.slice'
import { SocketProvider } from './SocketProvider'
import { ConnectionStatus, useConnectionStatus, useSocket } from './socket-context'

jest.mock('socket.io-client', () => ({ io: jest.fn() }))

function createConnection() {
  const handlers: Record<string, (...args: never[]) => unknown> = {}

  return {
    handlers,
    on: jest.fn((event: string, handler: (typeof handlers)[string]) => {
      handlers[event] = handler
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    // The manager of the socket, which counts the attempts to connect again
    io: {
      on: jest.fn((event: string, handler: (typeof handlers)[string]) => {
        handlers[`io:${event}`] = handler
      })
    }
  }
}

function Probe({
  onSocket,
  onStatus
}: {
  onSocket: (socket: unknown) => void
  onStatus: (status: ConnectionStatus) => void
}) {
  onSocket(useSocket())
  onStatus(useConnectionStatus())

  return null
}

function setup(token: string | null, auth = createFakeAuth()) {
  const store = setupStore()
  store.dispatch(setToken(token))
  // What the provider dispatches, with an identity that does not change between renders
  const dispatch = jest.fn(store.dispatch)
  store.dispatch = dispatch as unknown as typeof store.dispatch
  dispatch.mockClear()
  const seen: unknown[] = []
  const statuses: ConnectionStatus[] = []
  const view = render(
    <Provider store={store}>
      <AuthClientContext.Provider value={auth}>
        <SocketProvider>
          <Probe onSocket={(socket) => seen.push(socket)} onStatus={(status) => statuses.push(status)} />
        </SocketProvider>
      </AuthClientContext.Provider>
    </Provider>
  )

  return { store, seen, statuses, view, auth, dispatch }
}

describe('SocketProvider', () => {
  let connection: ReturnType<typeof createConnection>

  beforeEach(() => {
    connection = createConnection()
    jest.mocked(io).mockReturnValue(connection as never)
    localStorage.clear()
  })

  it('does not connect while the player is signed out', () => {
    const { seen } = setup(null)

    expect(io).not.toHaveBeenCalled()
    expect(seen.at(-1)).toBeNull()
  })

  it('connects with cookies and the latest token, and disconnects on unmount', () => {
    const { seen, view } = setup('token-1')
    const [url, options] = jest.mocked(io).mock.calls[0] as unknown as [
      string,
      { auth: (cb: (d: object) => void) => void }
    ]
    const authData = jest.fn()
    options.auth(authData)

    expect(url).toBe('http://api.test')
    expect(authData).toHaveBeenCalledWith({ token: 'token-1' })
    expect(seen.at(-1)).toBe(connection)

    view.unmount()

    expect(connection.disconnect).toHaveBeenCalled()
  })

  it('refreshes the session and reconnects after a handshake rejected for an expired token', async () => {
    const { auth } = setup('old')

    await act(async () => {
      await connection.handlers.connect_error({ message: SOCKET_TOKEN_EXPIRED } as never)
    })

    expect(auth.refresh).toHaveBeenCalled()
    expect(connection.connect).toHaveBeenCalled()
  })

  it('does not reconnect when the session could not be refreshed', async () => {
    const auth = createFakeAuth({ refresh: jest.fn(() => Promise.resolve(null)) })
    setup('old', auth)

    await act(async () => {
      await connection.handlers.connect_error({ message: SOCKET_TOKEN_EXPIRED } as never)
    })

    expect(connection.connect).not.toHaveBeenCalled()
  })

  it('leaves other connection errors alone', async () => {
    const { auth } = setup('old')

    await act(async () => {
      await connection.handlers.connect_error({ message: 'timeout' } as never)
    })

    expect(auth.refresh).not.toHaveBeenCalled()
  })

  it('reads the game time, the factory and the storage again when an admin changes the time of the game', () => {
    const { dispatch } = setup('token-1')

    act(() => void connection.handlers['game-time-changed']())

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'api/invalidateTags', payload: ['GameTime', 'Factory', 'Storage', 'Bases'] })
    )
  })

  describe('when the connection is lost', () => {
    const lose = (reason = 'transport close') => act(() => void connection.handlers.disconnect(reason as never))
    const reconnect = () => act(() => void connection.handlers.connect())

    it('says it is lost, then reconnecting, then restored for a few seconds, and reads the screen data again', () => {
      jest.useFakeTimers()
      const { statuses, dispatch } = setup('token-1')
      expect(statuses.at(-1)).toBe('connected')

      lose()
      expect(statuses.at(-1)).toBe('lost')
      act(() => void connection.handlers['io:reconnect_attempt']())
      expect(statuses.at(-1)).toBe('reconnecting')

      reconnect()
      expect(statuses.at(-1)).toBe('restored')
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'api/invalidateTags', payload: [...API_TAGS] })
      )
      act(() => void jest.advanceTimersByTime(4000))
      expect(statuses.at(-1)).toBe('connected')
      jest.useRealTimers()
    })

    it('says nothing about the first connection, and does not call an attempt a loss before there was one', () => {
      const { statuses, dispatch } = setup('token-1')

      act(() => void connection.handlers['io:reconnect_attempt']())
      reconnect()

      expect(new Set(statuses)).toEqual(new Set(['connected']))
      expect(dispatch).not.toHaveBeenCalled()
    })

    it('does not call the own sign-out a loss', () => {
      const { statuses } = setup('token-1')

      lose('io client disconnect')

      expect(new Set(statuses)).toEqual(new Set(['connected']))
    })

    it('connects again by itself when the server ended the connection', () => {
      setup('token-1')

      lose('io server disconnect')

      expect(connection.connect).toHaveBeenCalled()
    })

    it('says the connection is lost when the server cannot be reached at all', async () => {
      const { statuses } = setup('token-1')

      await act(async () => {
        await connection.handlers.connect_error({ message: 'xhr poll error' } as never)
      })

      expect(statuses.at(-1)).toBe('lost')
    })

    it('forgets a restored message that is still shown when the connection is lost again', () => {
      jest.useFakeTimers()
      const { statuses } = setup('token-1')

      lose()
      reconnect()
      lose()
      act(() => void jest.advanceTimersByTime(5000))

      expect(statuses.at(-1)).toBe('lost')
      jest.useRealTimers()
    })
  })
})
