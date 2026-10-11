import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { act, renderHook, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'
import messages from '../../../messages/en.json'
import { createFakeAuth } from '../../../tests/render'
import { AuthClientContext } from '../auth/auth-client-context'
import { GameSocket, SocketContext } from '../../shared/socket/socket-context'
import { useTerminal } from './useTerminal'

type Handler = (...args: never[]) => void

function createSocket(handlers: Record<string, (...args: never[]) => void>, isActive = true) {
  return {
    active: isActive,
    emit: jest.fn((event: string, ...args: never[]) => handlers[event]?.(...args))
  } as unknown as jest.Mocked<GameSocket>
}

const base = { _id: 'base-1', type: BOT_TYPE.BASE }
const auth = createFakeAuth()

function setup(socket: GameSocket | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <AuthClientContext.Provider value={auth}>
        <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
      </AuthClientContext.Provider>
    </NextIntlClientProvider>
  )

  return renderHook(() => useTerminal(), { wrapper })
}

const baseHandlers = (overrides: Record<string, Handler> = {}) => ({
  'get-user-bases': ((ack: (bases: unknown[]) => void) => ack([base])) as Handler,
  ...overrides
})

describe('useTerminal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('is loading until the socket answers', () => {
    const { result } = setup(null)

    expect(result.current.isLoading).toBe(true)
    expect(result.current.currentBotId).toBeNull()
  })

  it('does not ask for bases while the socket is not active', () => {
    const socket = createSocket({}, false)

    setup(socket)

    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('takes the first base as the current bot', async () => {
    const { result } = setup(createSocket(baseHandlers()))

    await waitFor(() => expect(result.current.currentBotId).toBe('base-1'))
    expect(result.current.isLoading).toBe(false)
  })

  it('stops loading without a current bot when the player has no base', async () => {
    const { result } = setup(createSocket({ 'get-user-bases': ((ack: (b: null) => void) => ack(null)) as Handler }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentBotId).toBeNull()
  })

  it('also stops loading when the answer is an empty list', async () => {
    const { result } = setup(createSocket({ 'get-user-bases': ((ack: (b: unknown[]) => void) => ack([])) as Handler }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentBotId).toBeNull()
  })

  it('echoes the input with the prompt and prints the reply', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('ls'))
    act(() => result.current.run('unknown <b>'))

    expect(result.current.lines).toEqual(['/&gt; ls', '', '/&gt; unknown &lt;b&gt;', 'Unknown command'])
  })

  it('echoes an empty command without output', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run(' '))

    expect(result.current.lines).toEqual(['/&gt;  '])
  })

  it('clears the screen', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('ls'))
    act(() => result.current.run('clear'))

    expect(result.current.lines).toEqual([])
  })

  it('enters and leaves shell mode with a clean screen', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('ls'))
    act(() => result.current.run('shell'))
    expect(result.current.isShellMode).toBe(true)
    expect(result.current.prefix).toBe('>>>')
    expect(result.current.lines).toEqual([])

    act(() => result.current.run('exit'))
    expect(result.current.isShellMode).toBe(false)
    expect(result.current.prefix).toBe('/>')
  })

  it('has no drives yet, so cd reports an unknown path', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('cd C'))

    expect(result.current.lines).toContain('Unknown path')
  })

  it('selects the drive when cd .. is accepted', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('cd ..'))

    expect(result.current.prefix).toBe('/>')
  })

  it('signs out on exit', () => {
    const { result } = setup(createSocket(baseHandlers()))

    act(() => result.current.run('exit'))

    expect(auth.signOut).toHaveBeenCalled()
  })

  it("lists the player's bots", async () => {
    const socket = createSocket(
      baseHandlers({ 'get-user-bots': ((ack: (b: unknown[]) => void) => ack([base])) as Handler })
    )
    const { result } = setup(socket)
    await waitFor(() => expect(result.current.currentBotId).toBe('base-1'))

    act(() => result.current.run('list'))

    expect(result.current.lines.at(-1)).toContain('(current) id=&quot;base-1&quot;')
  })

  it('lists no bots when the server sends nothing', () => {
    const { result } = setup(
      createSocket(baseHandlers({ 'get-user-bots': ((ack: (b: null) => void) => ack(null)) as Handler }))
    )

    act(() => result.current.run('list'))

    expect(result.current.lines).toEqual(['/&gt; list', ''])
  })

  it('lists the modules of the current bot', async () => {
    const socket = createSocket(
      baseHandlers({
        'get-bot-modules': ((_id: string, ack: (m: unknown[]) => void) =>
          ack([{ _id: 'm1', type: 'scanner', name: 'Scanner' }])) as Handler
      })
    )
    const { result } = setup(socket)
    await waitFor(() => expect(result.current.currentBotId).toBe('base-1'))

    act(() => result.current.run('modules'))

    expect(socket.emit).toHaveBeenCalledWith('get-bot-modules', 'base-1', expect.any(Function))
    expect(result.current.lines.at(-1)).toContain('name=&quot;Scanner&quot;')
  })

  it('shows the error of a failed module request', async () => {
    const socket = createSocket(
      baseHandlers({
        'get-bot-modules': ((_id: string, ack: (m: null, e: { code: number; msg: string }) => void) =>
          ack(null, { code: 403, msg: '<denied>' })) as Handler
      })
    )
    const { result } = setup(socket)
    await waitFor(() => expect(result.current.currentBotId).toBe('base-1'))

    act(() => result.current.run('modules'))

    expect(result.current.lines.at(-1)).toContain('&lt;denied&gt;')
  })

  it('says there is nothing when the server sends no modules and no error', async () => {
    const socket = createSocket(
      baseHandlers({ 'get-bot-modules': ((_id: string, ack: (m: null) => void) => ack(null)) as Handler })
    )
    const { result } = setup(socket)
    await waitFor(() => expect(result.current.currentBotId).toBe('base-1'))

    act(() => result.current.run('modules'))

    expect(result.current.lines.at(-1)).toBe('Nothing to show')
  })

  it('says there is nothing to show for modules without a current bot', () => {
    const { result } = setup(createSocket({ 'get-user-bases': ((ack: (b: null) => void) => ack(null)) as Handler }))

    act(() => result.current.run('modules'))

    expect(result.current.lines.at(-1)).toBe('Nothing to show')
  })

  it('prints nothing for a bot list when there is no socket', () => {
    const { result } = setup(null)

    act(() => result.current.run('list'))
    act(() => result.current.run('modules'))

    expect(result.current.lines).toEqual(['/&gt; modules', 'Nothing to show'])
  })
})
