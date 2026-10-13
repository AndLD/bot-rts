import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../../tests/render'
import { GameSocket, SocketContext } from '../../shared/socket/socket-context'
import Terminal from './Terminal'

function renderTerminal(socket: GameSocket | null) {
  return renderApp(
    <SocketContext.Provider value={socket}>
      <Terminal />
    </SocketContext.Provider>
  )
}

type Ack = (...args: unknown[]) => void

// A socket whose server answers every command with `commandResult`
function socketWith(bases: unknown, commandResult: unknown = { type: 'output', lines: [] }, onSave = jest.fn()) {
  const cwd = { drive: null, directory: null }
  const handlers: Record<string, (...args: unknown[]) => void> = {
    'get-user-bases': (ack) => (ack as Ack)(bases),
    'open-terminal': (_bot, ack) => (ack as Ack)({ _id: 's1' }),
    'terminal-command': (_session, _line, ack) => (ack as Ack)({ result: commandResult, cwd }),
    'save-terminal-file': (_session, path, content, ack) => {
      onSave(path, content)
      ;(ack as Ack)({ path })
    }
  }

  return {
    active: true,
    connected: true,
    emit: jest.fn((event: string, ...args: unknown[]) => handlers[event]?.(...args)),
    on: jest.fn(),
    off: jest.fn()
  } as unknown as GameSocket
}

const base = [{ _id: 'b1', type: BOT_TYPE.BASE }]

describe('Terminal', () => {
  it('says it is loading before the socket exists', () => {
    renderTerminal(null)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('says it failed to connect when the player has no base', () => {
    renderTerminal(socketWith([]))

    expect(screen.getByText('Failed to connect')).toBeInTheDocument()
  })

  it('welcomes a player with a base and runs a typed command', async () => {
    renderTerminal(socketWith(base, { type: 'error', code: 'UNKNOWN_COMMAND', message: 'x' }))

    expect(screen.getByText('# Welcome to BotOS Alpha 0.1.0 #')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'what{Enter}')

    expect(screen.getByText('Error: Unknown command')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('ignores other keys than Enter', async () => {
    renderTerminal(socketWith(base, { type: 'error', code: 'UNKNOWN_COMMAND', message: 'x' }))

    await userEvent.type(screen.getByRole('textbox'), 'what')

    expect(screen.queryByText('Error: Unknown command')).not.toBeInTheDocument()
  })

  it('leaves a reader who scrolled up where they are, until they type a command of their own', async () => {
    renderTerminal(socketWith(base))
    const scroller = screen.getByTestId('terminal-scroll')
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 300 })
    scroller.scrollTop = 100
    fireEvent.scroll(scroller)

    expect(scroller.scrollTop).toBe(100)

    await userEvent.type(screen.getByRole('textbox'), 'shell{Enter}')

    expect(scroller.scrollTop).toBe(1000)
  })

  it('shows the shell header in shell mode', async () => {
    renderTerminal(socketWith(base))

    await userEvent.type(screen.getByRole('textbox'), 'shell{Enter}')

    expect(screen.getByText('Bot shell v0.0.1, bot id = b1')).toBeInTheDocument()
  })

  it('focuses the input when the screen is clicked, but not when the output is', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderTerminal(socketWith(base))
    const input = screen.getByRole('textbox')

    input.blur()
    await user.click(screen.getByText('# Welcome to BotOS Alpha 0.1.0 #'))
    jest.runAllTimers()
    expect(input).not.toHaveFocus()

    await user.click(input.parentElement!)
    jest.runAllTimers()
    expect(input).toHaveFocus()
    jest.useRealTimers()
  })

  it('opens the editor for an edit command, saves the text and goes back to the prompt', async () => {
    const onSave = jest.fn()
    renderTerminal(socketWith(base, { type: 'edit', path: 'a.js', content: 'old' }, onSave))

    await userEvent.type(screen.getByRole('textbox'), 'edit a.js{Enter}')

    expect(screen.getByText('Editing a.js')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '' })).not.toBeInTheDocument()
    const text = screen.getByRole('textbox', { name: 'File content' })
    expect(text).toHaveValue('old')

    await userEvent.clear(text)
    await userEvent.type(text, 'new')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith('a.js', 'new')
    expect(screen.queryByText('Editing a.js')).not.toBeInTheDocument()
    expect(screen.getByText('Saved a.js')).toBeInTheDocument()
  })

  it('closes the editor without saving', async () => {
    const onSave = jest.fn()
    renderTerminal(socketWith(base, { type: 'edit', path: 'a.js', content: '' }, onSave))

    await userEvent.type(screen.getByRole('textbox'), 'edit a.js{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByText('Editing a.js')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not steal the focus from the editor when it is clicked', async () => {
    renderTerminal(socketWith(base, { type: 'edit', path: 'a.js', content: '' }))

    await userEvent.type(screen.getByRole('textbox'), 'edit a.js{Enter}')
    await userEvent.click(screen.getByText('Editing a.js'))

    expect(screen.getByRole('textbox', { name: 'File content' })).toBeInTheDocument()
  })

  it('shows a warning and takes no input while the bot is out of reach, and resumes when it is back', () => {
    const listeners: Array<(event: unknown) => void> = []
    const socket = socketWith(base)
    ;(socket.on as jest.Mock).mockImplementation((event: string, listener: (event: unknown) => void) => {
      if (event === 'game-event') listeners.push(listener)
    })
    renderApp(
      <SocketContext.Provider value={socket}>
        <Terminal connection={{ botId: 'bot-2', sessionId: 's2' }} />
      </SocketContext.Provider>
    )
    const push = (event: object) => act(() => listeners.forEach((listener) => listener(event)))
    const about = { at: 1, parties: [{ userId: 'u', botId: 'bot-2' }] }

    push({ ...about, type: 'LinkLost' })
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted')
    expect(screen.getByRole('textbox')).toBeDisabled()

    push({ ...about, type: 'LinkRestored', missed: { scans: 0, events: 0, byType: {} } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeEnabled()
  })
})
