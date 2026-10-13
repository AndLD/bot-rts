import { act, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { SocketContext } from '../../shared/socket/socket-context'
import AchievementBadges from './AchievementBadges'
import AchievementsPanel from './AchievementsPanel'
import AchievementToasts from './AchievementToasts'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const earnedAt = new Date('2026-10-12T10:00:00Z').getTime()
const list = [
  {
    id: 'prospector.1',
    family: 'prospector',
    level: 1,
    levels: 3,
    threshold: 100,
    progress: 100,
    unlockedAt: earnedAt
  },
  { id: 'prospector.2', family: 'prospector', level: 2, levels: 3, threshold: 1000, progress: 250, unlockedAt: null },
  { id: 'helloWorld', family: 'helloWorld', level: 1, levels: 1, threshold: 1, progress: 0, unlockedAt: null },
  { id: 'firstSteps', family: 'firstSteps', level: 1, levels: 1, threshold: 1, progress: 1, unlockedAt: earnedAt + 1 }
]

const opts = () => ({ store: storeWithToken(makeJwt(60)) })

describe('AchievementsPanel', () => {
  beforeEach(() => query.mockReset())

  it('shows the earned ones first, with the date, and the rest with their progress', async () => {
    query.mockResolvedValue({ data: list } as never)
    renderApp(<AchievementsPanel />, opts())

    expect(await screen.findByText('2 of 4 earned')).toBeInTheDocument()
    const titles = screen.getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)
    expect(titles).toEqual(['Prospector I', 'First steps', 'Prospector II', 'Hello, world'])
    expect(screen.getByText('Scan 100 cells')).toBeInTheDocument()
    expect(screen.getByText('Deploy a base')).toBeInTheDocument()
    expect(screen.getAllByText(/Earned/)).toHaveLength(2)
    expect(screen.getByText('250 / 1000')).toBeInTheDocument()
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
  })

  it('says it is loading, and when it could not load', async () => {
    query.mockImplementation(() => new Promise(() => undefined) as never)
    const { unmount } = renderApp(<AchievementsPanel />, opts())
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    unmount()

    query.mockResolvedValue({ error: { status: 500, data: {} } } as never)
    renderApp(<AchievementsPanel />, opts())

    expect(await screen.findByText('Could not load the achievements')).toBeInTheDocument()
  })
})

describe('AchievementBadges', () => {
  beforeEach(() => query.mockReset())

  it('shows a badge for each achievement earned, and says so when there is none', async () => {
    query.mockResolvedValue({ data: list } as never)
    const { unmount } = renderApp(<AchievementBadges />, opts())

    expect(await screen.findByText('Prospector I')).toBeInTheDocument()
    expect(screen.getByText('First steps')).toBeInTheDocument()
    expect(screen.queryByText('Hello, world')).not.toBeInTheDocument()
    unmount()

    query.mockResolvedValue({ data: [list[2]] } as never)
    renderApp(<AchievementBadges />, opts())

    expect(await screen.findByText('No badges yet')).toBeInTheDocument()
  })
})

describe('AchievementToasts', () => {
  const unlock = { id: 'prospector.2', family: 'prospector', level: 2, levels: 3, threshold: 1000, unlockedAt: 1 }

  function fakeSocket() {
    const handlers = new Map<string, (payload: unknown) => void>()

    return {
      on: jest.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
      off: jest.fn((event: string) => handlers.delete(event)),
      emit: (event: string, payload: unknown) => handlers.get(event)?.(payload)
    }
  }

  beforeEach(() => jest.restoreAllMocks())

  it('congratulates the player on an achievement, and refreshes the list', async () => {
    const open = jest.spyOn(notification, 'open').mockImplementation(() => undefined)
    const socket = fakeSocket()
    const store = storeWithToken(makeJwt(60))
    const dispatch = jest.spyOn(store, 'dispatch')
    renderApp(
      <SocketContext.Provider value={socket as never}>
        <AchievementToasts />
      </SocketContext.Provider>,
      { store }
    )

    act(() => socket.emit('achievement-unlocked', unlock))

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Achievement unlocked', description: 'Prospector II' })
      )
    )
    expect(dispatch).toHaveBeenCalled()
  })

  it('stops listening when it goes away, and does nothing without a connection', () => {
    const socket = fakeSocket()
    const { unmount } = renderApp(
      <SocketContext.Provider value={socket as never}>
        <AchievementToasts />
      </SocketContext.Provider>,
      opts()
    )

    unmount()
    expect(socket.off).toHaveBeenCalledWith('achievement-unlocked', expect.any(Function))

    renderApp(<AchievementToasts />, opts())
    expect(socket.on).toHaveBeenCalledTimes(1)
  })
})
