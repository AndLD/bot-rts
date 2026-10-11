import { BOT_TYPE } from '@lib/utils/interfaces/bots'
import { screen } from '@testing-library/react'
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

const socketWith = (bases: unknown) =>
  ({
    active: true,
    emit: jest.fn((event: string, ack: (b: unknown) => void) => event === 'get-user-bases' && ack(bases))
  }) as unknown as GameSocket

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
    renderTerminal(socketWith([{ _id: 'b1', type: BOT_TYPE.BASE }]))

    expect(screen.getByText('# Welcome to BotOS Alpha 0.1.0 #')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'what{Enter}')

    expect(screen.getByText('Unknown command')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('ignores other keys than Enter', async () => {
    renderTerminal(socketWith([{ _id: 'b1', type: BOT_TYPE.BASE }]))

    await userEvent.type(screen.getByRole('textbox'), 'what')

    expect(screen.queryByText('Unknown command')).not.toBeInTheDocument()
  })

  it('shows the shell header in shell mode', async () => {
    renderTerminal(socketWith([{ _id: 'b1', type: BOT_TYPE.BASE }]))

    await userEvent.type(screen.getByRole('textbox'), 'shell{Enter}')

    expect(screen.getByText('Bot shell v0.0.1, bot id = b1')).toBeInTheDocument()
  })

  it('focuses the input when the screen is clicked, but not when the output is', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderTerminal(socketWith([{ _id: 'b1', type: BOT_TYPE.BASE }]))
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
})
