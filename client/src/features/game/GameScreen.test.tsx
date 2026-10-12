import { act, fireEvent, screen } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import { setupStore } from '../../shared/store'
import { openWindow } from '../windows/windows.slice'
import GameScreen from './GameScreen'

jest.mock('../map/GameMap', () => ({
  __esModule: true,
  default: ({ baseId }: { baseId: string }) => <div>the map of {baseId}</div>
}))
jest.mock('../storage/StoragePanel', () => ({
  __esModule: true,
  default: ({ botId }: { botId: string }) => <div>the storage of {botId}</div>
}))
jest.mock('../terminal/Terminal', () => ({ __esModule: true, default: () => <div>the terminal</div> }))

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

  it('titles the windows of kinds that have no content yet', () => {
    const store = setupStore()
    renderApp(<GameScreen baseId="b1" />, { store })

    act(() => void store.dispatch(openWindow({ id: 'factory', kind: 'factory' })))

    expect(screen.getByText('Factory', { selector: 'header span' })).toBeInTheDocument()
  })
})
