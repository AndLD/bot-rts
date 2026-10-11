import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'
import { act, render } from '@testing-library/react'
import { io } from 'socket.io-client'
import { Provider } from 'react-redux'
import { createFakeAuth } from '../../../tests/render'
import { AuthClientContext } from '../../features/auth/auth-client-context'
import { setupStore } from '../store'
import { setToken } from '../store/session.slice'
import { SocketProvider } from './SocketProvider'
import { useSocket } from './socket-context'

jest.mock('socket.io-client', () => ({ io: jest.fn() }))

function createConnection() {
  const handlers: Record<string, (...args: never[]) => unknown> = {}

  return {
    handlers,
    on: jest.fn((event: string, handler: (typeof handlers)[string]) => {
      handlers[event] = handler
    }),
    connect: jest.fn(),
    disconnect: jest.fn()
  }
}

function Probe({ onSocket }: { onSocket: (socket: unknown) => void }) {
  onSocket(useSocket())

  return null
}

function setup(token: string | null, auth = createFakeAuth()) {
  const store = setupStore()
  store.dispatch(setToken(token))
  const seen: unknown[] = []
  const view = render(
    <Provider store={store}>
      <AuthClientContext.Provider value={auth}>
        <SocketProvider>
          <Probe onSocket={(socket) => seen.push(socket)} />
        </SocketProvider>
      </AuthClientContext.Provider>
    </Provider>
  )

  return { store, seen, view, auth }
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
})
