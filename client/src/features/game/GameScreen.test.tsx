import { act, fireEvent, screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import { setupStore } from '../../shared/store'
import { openWindow } from '../windows/windows.slice'
import GameScreen from './GameScreen'

jest.mock('../map/GameMap', () => ({
  __esModule: true,
  default: ({ baseId }: { baseId: string }) => <div>the map of {baseId}</div>
}))
jest.mock('../factory/FactoryPanel', () => ({
  __esModule: true,
  default: ({ baseId }: { baseId: string }) => <div>the factory of {baseId}</div>
}))
jest.mock('../storage/StoragePanel', () => ({
  __esModule: true,
  default: ({ botId }: { botId: string }) => <div>the storage of {botId}</div>
}))
jest.mock('../terminal/Terminal', () => ({
  __esModule: true,
  default: ({
    connection,
    onConnected,
    onExit
  }: {
    connection?: { botId: string }
    onConnected?: (c: { botId: string; sessionId: string }) => void
    onExit?: () => void
  }) => (
    <div>
      {connection ? `the terminal of ${connection.botId}` : 'the terminal'}
      <button onClick={() => onConnected?.({ botId: 'bot-2-long-id', sessionId: 's2' })}>connect</button>
      <button onClick={onExit}>leave</button>
    </div>
  )
}))

beforeEach(() => localStorage.clear())

describe('GameScreen', () => {
  it('shows the map with the terminal open over it', () => {
    renderApp(<GameScreen baseId="b1" />)

    expect(screen.getByText('the map of b1')).toBeInTheDocument()
    expect(screen.getByText('the terminal')).toBeInTheDocument()
    expect(screen.getByText('Terminal', { selector: 'header span' })).toBeInTheDocument()
  })

  it('opens a closed terminal again from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }))
    expect(screen.queryByText('the terminal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))

    expect(screen.getByText('the terminal')).toBeInTheDocument()
  })

  it('opens the storage of the base from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Storage' }))

    expect(screen.getByText('the storage of b1')).toBeInTheDocument()
  })

  it('opens the factory of the base from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Factory' }))

    expect(screen.getByText('the factory of b1')).toBeInTheDocument()
  })

  it('titles the windows of kinds that have no content yet', () => {
    const store = setupStore()
    renderApp(<GameScreen baseId="b1" />, { store })

    act(() => void store.dispatch(openWindow({ id: 'settings', kind: 'settings' })))

    expect(screen.getByText('Settings', { selector: 'header span' })).toBeInTheDocument()
  })

  it('opens a window of its own for a bot that connect reached, and closes it on exit', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByText('connect'))

    expect(screen.getByText('the terminal of bot-2-long-id')).toBeInTheDocument()
    expect(screen.getByText('Terminal bot-2-lo', { selector: 'header span' })).toBeInTheDocument()

    // The terminal of the connected bot can connect on, and leaves with exit
    const connected = screen.getByText('the terminal of bot-2-long-id')
    fireEvent.click(connected.querySelector('button:last-child') as HTMLElement)
    expect(screen.queryByText('the terminal of bot-2-long-id')).not.toBeInTheDocument()
  })

  it('lets a connected terminal connect on to another bot', () => {
    renderApp(<GameScreen baseId="b1" />)
    fireEvent.click(screen.getByText('connect'))

    const connected = screen.getByText('the terminal of bot-2-long-id')
    fireEvent.click(connected.querySelector('button:first-of-type') as HTMLElement)

    expect(screen.getAllByText('the terminal of bot-2-long-id')).toHaveLength(1)
  })
})
