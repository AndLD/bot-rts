import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderApp } from '../../../tests/render'
import { setupStore } from '../../shared/store'
import { openWindow } from '../windows/windows.slice'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { makeJwt } from '../../../tests/jwt'
import { storeWithToken } from '../../../tests/render'
import GameScreen from './GameScreen'

jest.mock('../map/GameMap', () => ({
  __esModule: true,
  default: ({ baseId, onOpenBot }: { baseId: string; onOpenBot: (id: string) => void }) => (
    <div>
      the map of {baseId}
      <button onClick={() => onOpenBot('bot-9-long-id')}>click a bot</button>
    </div>
  )
}))
jest.mock('../factory/FactoryPanel', () => ({
  __esModule: true,
  default: ({ baseId }: { baseId: string }) => <div>the factory of {baseId}</div>
}))
jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../tutorial/TutorialOverlay', () => ({ __esModule: true, default: () => <div>the tutorial</div> }))
jest.mock('../control/ControlPanel', () => ({
  __esModule: true,
  default: ({ botId, onOpenStorage }: { botId: string; onOpenStorage: (id: string) => void }) => (
    <div>
      the control of {botId}
      <button onClick={() => onOpenStorage(botId)}>open its storage</button>
    </div>
  )
}))
jest.mock('../help/HelpPanel', () => ({ __esModule: true, default: () => <div>the help</div> }))
jest.mock('../notifications/NotificationCenter', () => ({
  __esModule: true,
  default: () => <div>the notification center</div>
}))
jest.mock('../notifications/NotificationToasts', () => ({
  __esModule: true,
  default: () => <div>the notification toasts</div>
}))
jest.mock('../notifications/AwaySummary', () => ({ __esModule: true, default: () => <div>the away summary</div> }))
jest.mock('../achievements/AchievementsPanel', () => ({ __esModule: true, default: () => <div>the achievements</div> }))
jest.mock('../achievements/AchievementToasts', () => ({ __esModule: true, default: () => <div>the toasts</div> }))
jest.mock('../settings/SettingsPanel', () => ({ __esModule: true, default: () => <div>the settings</div> }))
jest.mock('../storage/StoragePanel', () => ({
  __esModule: true,
  default: ({ botId }: { botId: string }) => <div>the storage of {botId}</div>
}))
jest.mock('../terminal/Terminal', () => ({
  __esModule: true,
  default: ({
    connection,
    onConnected,
    onExit,
    onHelp
  }: {
    connection?: { botId: string }
    onConnected?: (c: { botId: string; sessionId: string }) => void
    onExit?: () => void
    onHelp?: (slug: string) => void
  }) => (
    <div>
      {connection ? `the terminal of ${connection.botId}` : 'the terminal'}
      <button onClick={() => onHelp?.('api')}>ask for help</button>
      <button onClick={() => onConnected?.({ botId: 'bot-2-long-id', sessionId: 's2' })}>connect</button>
      <button onClick={onExit}>leave</button>
    </div>
  )
}))

const query = jest.mocked(baseQueryWithRefresh)
const tutorialAt = (current: string | null) => ({ data: { status: 'active', steps: [], current } })

beforeEach(() => {
  localStorage.clear()
  query.mockReset()
  query.mockResolvedValue(tutorialAt(null) as never)
})

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

  it('opens the settings from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByText('the settings')).toBeInTheDocument()
  })

  it('opens the achievements from the toolbar, and listens for new ones', () => {
    renderApp(<GameScreen baseId="b1" />)

    expect(screen.getByText('the toasts')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Achievements' }))

    expect(screen.getByText('the achievements')).toBeInTheDocument()
  })

  it('opens the notification center from the toolbar, which shows how many are unread', async () => {
    query.mockImplementation((async (args: { url: string }) =>
      args.url.endsWith('/notifications/summary') ? { data: { unread: 5, byCategory: {} } } : { data: {} }) as never)
    renderApp(<GameScreen baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(await screen.findByText('5')).toBeInTheDocument()
    expect(screen.getByText('the notification toasts')).toBeInTheDocument()
    expect(screen.getByText('the away summary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(screen.getByText('the notification center')).toBeInTheDocument()
  })

  it('opens the Help window from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))

    expect(screen.getByText('the help')).toBeInTheDocument()
  })

  it('opens the Help window at the page of a topic the terminal names', () => {
    const store = setupStore()
    renderApp(<GameScreen baseId="b1" />, { store })

    fireEvent.click(screen.getByRole('button', { name: 'ask for help' }))

    expect(store.getState().help.slug).toBe('api')
    expect(store.getState().windows.windows.some((window) => window.kind === 'help')).toBe(true)
  })

  it('opens the factory of the base from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Factory' }))

    expect(screen.getByText('the factory of b1')).toBeInTheDocument()
  })

  it('titles the windows of kinds that have no content yet', () => {
    const store = setupStore()
    renderApp(<GameScreen baseId="b1" />, { store })

    act(() => void store.dispatch(openWindow({ id: 'editor', kind: 'editor' })))

    expect(screen.getByText('Editor', { selector: 'header span' })).toBeInTheDocument()
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

  it('opens the control panel of a bot clicked on the map, and of the base from the toolbar', () => {
    renderApp(<GameScreen baseId="b1" />)

    fireEvent.click(screen.getByText('click a bot'))
    expect(screen.getByText('the control of bot-9-long-id')).toBeInTheDocument()
    expect(screen.getByText('Control bot-9-lo', { selector: 'header span' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Control panel' }))
    expect(screen.getByText('the control of b1')).toBeInTheDocument()
  })

  it('shows the tutorial over the screen', () => {
    renderApp(<GameScreen baseId="b1" />)

    expect(screen.getByText('the tutorial')).toBeInTheDocument()
  })

  it.each([
    ['openTerminal', 'Terminal'],
    ['scan', 'Control panel'],
    ['craft', 'Factory'],
    ['assemble', 'Factory']
  ])('points at the button of the %s step', async (step, button) => {
    query.mockResolvedValue(tutorialAt(step) as never)
    renderApp(<GameScreen baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    await waitFor(() => expect(screen.getByRole('button', { name: button })).toHaveClass('tutorial-highlight'))
    expect(screen.getAllByRole('button').filter((b) => b.classList.contains('tutorial-highlight'))).toHaveLength(1)
  })

  it('opens the storage of a bot from its control panel, next to the one of the base', () => {
    renderApp(<GameScreen baseId="b1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }))
    fireEvent.click(screen.getByText('click a bot'))

    fireEvent.click(screen.getByText('open its storage'))

    expect(screen.getByText('the storage of b1')).toBeInTheDocument()
    expect(screen.getByText('the storage of bot-9-long-id')).toBeInTheDocument()
  })
})
