import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { ITerminalCommandResponse, ITerminalCwd, TerminalCommandResult } from '@lib/utils/interfaces/terminal'
import { act, renderHook, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'
import messages from '../../../messages/en.json'
import { createFakeAuth } from '../../../tests/render'
import { AuthClientContext } from '../auth/auth-client-context'
import { GameSocket, SocketContext } from '../../shared/socket/socket-context'
import { useTerminal } from './useTerminal'

type Handler = (...args: never[]) => void

function createSocket(handlers: Record<string, Handler>, isActive = true) {
  const listeners = new Map<string, Set<Handler>>()
  return {
    active: isActive,
    emit: jest.fn((event: string, ...args: never[]) => handlers[event]?.(...args)),
    on: jest.fn((event: string, listener: Handler) =>
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener))
    ),
    off: jest.fn((event: string, listener: Handler) => listeners.get(event)?.delete(listener)),
    // What the server pushes
    push: (event: string, ...args: never[]) => listeners.get(event)?.forEach((listener) => listener(...args))
  } as unknown as jest.Mocked<GameSocket> & { push: (event: string, ...args: unknown[]) => void }
}

const base = { _id: 'base-1', type: BOT_TYPE.BASE }
const auth = createFakeAuth()
const top: ITerminalCwd = { drive: null, directory: null }

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

// The server answers every command with the given result and place
const answering = (result: TerminalCommandResult, cwd = top): Handler =>
  ((_session: string, _line: string, ack: (response: ITerminalCommandResponse) => void) =>
    ack({ result, cwd })) as Handler

const handlers = (overrides: Record<string, Handler> = {}): Record<string, Handler> => ({
  'get-user-bases': ((ack: (bases: unknown[]) => void) => ack([base])) as Handler,
  'open-terminal': ((_bot: string, ack: (session: unknown) => void) => ack({ _id: 'session-1' })) as Handler,
  'terminal-command': answering({ type: 'output', lines: [] }),
  ...overrides
})

async function connected(overrides: Record<string, Handler> = {}) {
  const socket = createSocket(handlers(overrides))
  const hook = setup(socket)
  await waitFor(() => expect(hook.result.current.currentBotId).toBe('base-1'))
  return { socket, ...hook }
}

describe('useTerminal: connecting', () => {
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

  it('takes the first base as the current bot and opens a stored session on it', async () => {
    const { socket, result } = await connected()

    expect(result.current.isLoading).toBe(false)
    expect(socket.emit).toHaveBeenCalledWith('open-terminal', 'base-1', expect.any(Function))
  })

  it.each([[null], [[]]])('stops loading without a bot when the answer is %p', async (bases) => {
    const { result } = setup(createSocket({ 'get-user-bases': ((ack: (b: unknown) => void) => ack(bases)) as Handler }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentBotId).toBeNull()
  })

  it('shows no prompt and runs nothing when the server does not open a session', async () => {
    const socket = createSocket(
      handlers({ 'open-terminal': ((_b: string, ack: (s: null) => void) => ack(null)) as Handler })
    )
    const { result } = setup(socket)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.run('ls'))

    expect(result.current.currentBotId).toBeNull()
    expect(result.current.lines).toEqual(['/&gt; ls', 'The terminal is not connected yet'])
  })
})

describe('useTerminal: commands', () => {
  beforeEach(() => jest.clearAllMocks())

  it('echoes the input and prints the lines of the answer, escaped', async () => {
    const { result } = await connected({ 'terminal-command': answering({ type: 'output', lines: ['a<b>', 'c'] }) })

    act(() => result.current.run('ls'))

    expect(result.current.lines).toEqual(['/&gt; ls', 'a&lt;b&gt;', 'c'])
  })

  it('sends the typed line with the session', async () => {
    const { socket, result } = await connected()

    act(() => result.current.run('  cat  a.txt '))

    expect(socket.emit).toHaveBeenCalledWith('terminal-command', 'session-1', 'cat  a.txt', expect.any(Function))
  })

  it('follows the place the server reports in the prompt', async () => {
    const { result } = await connected({
      'terminal-command': answering({ type: 'output', lines: [] }, { drive: 'memory', directory: 'scripts' })
    })

    act(() => result.current.run('cd memory/scripts'))

    expect(result.current.prefix).toBe('/memory/scripts>')
  })

  it('prints the help with the translated description of every command', async () => {
    const { result } = await connected({
      'terminal-command': answering({ type: 'help', commands: [{ name: 'ls', usage: 'ls [dir]' }] })
    })

    act(() => result.current.run('help'))

    expect(result.current.lines.at(-1)).toBe('ls [dir] - list the drives or the files')
  })

  it('clears the screen when the server asks', async () => {
    const { result } = await connected({ 'terminal-command': answering({ type: 'clear' }) })

    act(() => result.current.run('anything'))

    expect(result.current.lines).toEqual([])
  })

  it('clears the screen by itself for clear', async () => {
    const { socket, result } = await connected()
    act(() => result.current.run('ls'))
    socket.emit.mockClear()

    act(() => result.current.run('clear'))

    expect(result.current.lines).toEqual([])
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it('signs out when the server says exit', async () => {
    const { result } = await connected({ 'terminal-command': answering({ type: 'exit' }) })

    act(() => result.current.run('exit'))

    expect(auth.signOut).toHaveBeenCalled()
  })

  it('shows an error by its code when we have a text for it', async () => {
    const { result } = await connected({
      'terminal-command': answering({ type: 'error', code: 'UNKNOWN_COMMAND', message: 'Unknown command: x' })
    })

    act(() => result.current.run('x'))

    expect(result.current.lines.at(-1)).toBe('Error: Unknown command')
  })

  it('shows an error by its message when the code has no text', async () => {
    const { result } = await connected({
      'terminal-command': answering({ type: 'error', code: 'SOMETHING_NEW', message: 'raw <text>' })
    })

    act(() => result.current.run('x'))

    expect(result.current.lines.at(-1)).toBe('Error: raw &lt;text&gt;')
  })

  it('shows the message of a usage error, which says how to use the command', async () => {
    const { result } = await connected({
      'terminal-command': answering({ type: 'error', code: 'COMMAND_USAGE', message: 'Usage: cat <file>' })
    })

    act(() => result.current.run('cat'))

    expect(result.current.lines.at(-1)).toBe('Error: Usage: cat &lt;file&gt;')
  })

  it('shows a failed request as an error', async () => {
    const { result } = await connected({
      'terminal-command': ((_s: string, _l: string, ack: (r: null, e: { code: number; msg: string }) => void) =>
        ack(null, { code: 403, msg: 'denied' })) as Handler
    })

    act(() => result.current.run('ls'))
    act(() => result.current.run('ls'))

    expect(result.current.lines.at(-1)).toBe('Error: denied')
  })

  it('shows a generic error for a failed request without a message', async () => {
    const { result } = await connected({
      'terminal-command': ((_s: string, _l: string, ack: (r: null) => void) => ack(null)) as Handler
    })

    act(() => result.current.run('ls'))

    expect(result.current.lines.at(-1)).toBe('Error: Something went wrong')
  })

  it('echoes an empty line without output', async () => {
    const { result } = await connected()

    act(() => result.current.run(' '))

    expect(result.current.lines).toEqual(['/&gt;  '])
  })

  it('enters and leaves shell mode with a clean screen, without asking the server', async () => {
    const { socket, result } = await connected()
    socket.emit.mockClear()

    act(() => result.current.run('shell'))
    expect(result.current.isShellMode).toBe(true)
    expect(result.current.prefix).toBe('>>>')

    act(() => result.current.run('exit'))
    expect(result.current.isShellMode).toBe(false)
    expect(result.current.prefix).toBe('/>')
    expect(socket.emit).not.toHaveBeenCalled()
  })
})

describe('useTerminal: scripts', () => {
  beforeEach(() => jest.clearAllMocks())

  const log = (botId: string, text: string) => ({ executionId: 'abcdef0123456789', botId, kind: 'output', text })

  it('shows what a script of the bot writes as it is written, escaped, and ignores other bots', async () => {
    const { socket, result } = await connected()

    act(() => socket.push('script-log', log('base-1', '<b>hi</b>')))
    act(() => socket.push('script-log', log('other-bot', 'not mine')))

    expect(result.current.lines).toEqual(['[abcdef01] &lt;b&gt;hi&lt;/b&gt;'])
  })

  it('says when a script of the bot ends, but not while it runs', async () => {
    const { socket, result } = await connected()
    const execution = (state: string, botId = 'base-1') => ({ id: 'abcdef0123456789', botId, state })

    act(() => socket.push('execution', execution('running')))
    act(() => socket.push('execution', execution('finished', 'other-bot')))
    act(() => socket.push('execution', execution('finished')))
    act(() => socket.push('execution', execution('killed')))

    expect(result.current.lines).toEqual(['[abcdef01] finished', '[abcdef01] killed'])
  })

  it('stops listening when the terminal goes away', async () => {
    const { socket, unmount } = await connected()

    unmount()

    expect(socket.off).toHaveBeenCalledWith('script-log', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('execution', expect.any(Function))
  })

  it('sends the lines of the shell mode as code', async () => {
    const { socket, result } = await connected()
    act(() => result.current.run('shell'))
    socket.emit.mockClear()

    act(() => result.current.run('bot.id'))

    expect(socket.emit).toHaveBeenCalledWith('terminal-command', 'session-1', 'eval bot.id', expect.any(Function))
  })
})

describe('useTerminal: connecting to other bots', () => {
  beforeEach(() => jest.clearAllMocks())

  const connectResult = answering({ type: 'connected', sessionId: 'session-2', botId: 'bot-2' })

  it('works in the new terminal after connect, and returns to the one before with exit', async () => {
    const { socket, result } = await connected({ 'terminal-command': connectResult })

    act(() => result.current.run('connect bot-2 pw'))
    expect(result.current.currentBotId).toBe('bot-2')
    expect(result.current.lines.at(-1)).toBe('Connected to bot-2; exit returns')
    act(() => result.current.run('help'))
    expect(socket.emit).toHaveBeenLastCalledWith('terminal-command', 'session-2', 'help', expect.any(Function))
  })

  it('leaves the connected terminal on exit, closing its session, and signs out only from the first one', async () => {
    const { socket, result } = await connected({
      'close-terminal': ((_id: string, ack: () => void) => ack()) as Handler,
      'terminal-command': ((_session: string, line: string, ack: (response: ITerminalCommandResponse) => void) =>
        ack({
          result: line.startsWith('connect')
            ? { type: 'connected', sessionId: 'session-2', botId: 'bot-2' }
            : { type: 'exit' },
          cwd: top
        })) as Handler
    })

    act(() => result.current.run('connect bot-2'))
    act(() => result.current.run('exit'))

    expect(socket.emit).toHaveBeenCalledWith('close-terminal', 'session-2', expect.any(Function))
    expect(result.current.currentBotId).toBe('base-1')
    expect(result.current.lines.at(-1)).toBe('Back on base-1')

    act(() => result.current.run('exit'))
    expect(auth.signOut).toHaveBeenCalled()
  })
})

describe('useTerminal: the editor', () => {
  beforeEach(() => jest.clearAllMocks())

  const edit = answering({ type: 'edit', path: 'a.js', content: 'old' })

  it('opens the file of an edit command and closes without saving', async () => {
    const { result } = await connected({ 'terminal-command': edit })

    act(() => result.current.run('edit a.js'))
    expect(result.current.editor).toEqual({ path: 'a.js', content: 'old' })

    act(() => result.current.closeEditor())
    expect(result.current.editor).toBeNull()
  })

  it('saves the file through the server and says so', async () => {
    const { socket, result } = await connected({
      'terminal-command': edit,
      'save-terminal-file': ((_s: string, _p: string, _c: string, ack: (f: unknown) => void) =>
        ack({ path: 'dir/a.js' })) as Handler
    })
    act(() => result.current.run('edit a.js'))

    act(() => result.current.saveEditor('new'))

    expect(socket.emit).toHaveBeenCalledWith('save-terminal-file', 'session-1', 'a.js', 'new', expect.any(Function))
    expect(result.current.editor).toBeNull()
    expect(result.current.lines.at(-1)).toBe('Saved dir/a.js')
  })

  it('keeps the editor open and shows the reason when saving fails', async () => {
    const { result } = await connected({
      'terminal-command': edit,
      'save-terminal-file': ((
        _s: string,
        _p: string,
        _c: string,
        ack: (f: null, e: { code: number; msg: string }) => void
      ) => ack(null, { code: 413, msg: 'full' })) as Handler
    })
    act(() => result.current.run('edit a.js'))

    act(() => result.current.saveEditor('new'))

    expect(result.current.editor).not.toBeNull()
    expect(result.current.lines.at(-1)).toBe('Error: full')
  })

  it('shows a generic error when saving fails without a message', async () => {
    const { result } = await connected({
      'terminal-command': edit,
      'save-terminal-file': ((_s: string, _p: string, _c: string, ack: (f: null) => void) => ack(null)) as Handler
    })
    act(() => result.current.run('edit a.js'))

    act(() => result.current.saveEditor('new'))

    expect(result.current.lines.at(-1)).toBe('Error: Something went wrong')
  })

  it('saves nothing without an open editor', async () => {
    const { socket, result } = await connected()
    socket.emit.mockClear()

    act(() => result.current.saveEditor('x'))

    expect(socket.emit).not.toHaveBeenCalled()
  })
})
