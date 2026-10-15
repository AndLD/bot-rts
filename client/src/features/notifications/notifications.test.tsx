import { INotification } from '@lib/utils/interfaces/notifications'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { SocketContext } from '../../shared/socket/socket-context'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import AwaySummary, { AWAY_SHOWN_KEY } from './AwaySummary'
import NotificationCenter from './NotificationCenter'
import NotificationPreferences from './NotificationPreferences'
import NotificationToasts from './NotificationToasts'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const now = Date.now()
const item = (overrides: Partial<INotification> = {}): INotification => ({
  id: 'n1',
  category: 'damage',
  kind: 'moduleBroken',
  params: {},
  botId: 'abcdef12-0000',
  count: 1,
  createdAt: now - 60_000,
  readAt: null,
  ...overrides
})

type Call = { url: string; method?: string; body?: unknown; params?: Record<string, unknown> }

function serve(handlers: Record<string, (call: Call) => unknown>) {
  const calls: Call[] = []
  query.mockReset()
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const key = Object.keys(handlers).find((url) => args.url.endsWith(url))

    return key ? { data: handlers[key](args) } : { data: {} }
  }) as never)

  return calls
}

const opts = () => ({ store: storeWithToken(makeJwt(60)) })

describe('NotificationCenter', () => {
  it("lists the notifications in the player's language, with the unread ones marked, and a count for a coalesced one", async () => {
    serve({
      '/notifications': () => ({
        unread: 3,
        items: [
          item({ id: 'a', kind: 'underAttack', category: 'attacks', count: 4 }),
          item({ id: 'b', kind: 'craftDone', category: 'fabrication', params: { module: 'drill-class1', count: 2 } }),
          item({ id: 'c', kind: 'passwordFailed', category: 'security', params: { lockedOut: true } }),
          item({ id: 'd', kind: 'linkWeak', params: { bars: 1 }, readAt: now }),
          item({
            id: 'e',
            kind: 'achievementUnlocked',
            category: 'achievements',
            botId: null,
            params: { family: 'prospector', level: 2, levels: 3, threshold: 1000 }
          }),
          item({ id: 'g', kind: 'announcement', category: 'system', botId: null, params: { text: 'Update {soon}' } }),
          item({ id: 'f', kind: 'somethingNew' })
        ]
      })
    })
    renderApp(<NotificationCenter />, opts())

    expect(await screen.findByText('Your bot abcdef12 is under attack')).toBeInTheDocument()
    expect(screen.getByText('×4')).toBeInTheDocument()
    expect(screen.getByText('2 modules of Drill, class 1 ready')).toBeInTheDocument()
    expect(screen.getByText('Bot abcdef12 is locked out after wrong passwords')).toBeInTheDocument()
    expect(screen.getByText('The signal of bot abcdef12 is weak: 1 of 4 bars')).toBeInTheDocument()
    expect(screen.getByText('Achievement unlocked: Prospector II')).toBeInTheDocument()
    expect(screen.getByText('Announcement: Update {soon}')).toBeInTheDocument()
    expect(screen.getByText('Something happened')).toBeInTheDocument()
    expect(screen.getByText('3 unread')).toBeInTheDocument()
    expect(screen.getAllByText('1 minute ago').length).toBeGreaterThan(0)
  })

  it('marks a notification as read when it is clicked, and all of them on request', async () => {
    const calls = serve({
      '/notifications': () => ({ unread: 2, items: [item({ id: 'a' }), item({ id: 'b', readAt: now })] }),
      '/notifications/read': () => ({ marked: 1 })
    })
    renderApp(<NotificationCenter />, opts())

    const texts = await screen.findAllByText('A module of bot abcdef12 is broken')
    fireEvent.click(texts[0])
    fireEvent.click(texts[1])
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))

    await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/notifications/read'))).toHaveLength(2))
    expect(calls.filter((call) => call.url.endsWith('/notifications/read')).map((call) => call.body)).toEqual([
      { ids: ['a'] },
      {}
    ])
  })

  it('shows only the unread when asked', async () => {
    const calls = serve({ '/notifications': () => ({ unread: 0, items: [] }) })
    renderApp(<NotificationCenter />, opts())

    expect(await screen.findByText('Nothing yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(calls.some((call) => call.params?.unread === true)).toBe(true))
  })

  it('loads older pages on request, and stops offering them at the end', async () => {
    const page = (start: number, size: number) =>
      Array.from({ length: size }, (_, index) =>
        item({ id: `n${start + index}`, createdAt: now - (start + index) * 1000 })
      )
    const calls = serve({
      '/notifications': (call) =>
        call.params?.before === undefined ? { unread: 40, items: page(0, 30) } : { unread: 40, items: page(30, 5) }
    })
    renderApp(<NotificationCenter />, opts())

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(35))
    expect(calls.find((call) => call.params?.before !== undefined)?.params).toMatchObject({ limit: 30 })
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('says it is loading, and when it could not load', async () => {
    query.mockImplementation(() => new Promise(() => undefined) as never)
    const { unmount } = renderApp(<NotificationCenter />, opts())
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    unmount()

    query.mockResolvedValue({ error: { status: 500, data: {} } } as never)
    renderApp(<NotificationCenter />, opts())

    expect(await screen.findByText('Could not load the notifications')).toBeInTheDocument()
  })
})

describe('NotificationToasts', () => {
  function fakeSocket() {
    const handlers = new Map<string, (payload: unknown) => void>()

    return {
      on: jest.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
      off: jest.fn((event: string) => handlers.delete(event)),
      emit: (event: string, payload: unknown) => handlers.get(event)?.(payload)
    }
  }

  beforeEach(() => jest.restoreAllMocks())

  it('shows a toast for a new notification, not again when it is coalesced, and skips achievements', async () => {
    const open = jest.spyOn(notification, 'open').mockImplementation(() => undefined)
    const socket = fakeSocket()
    serve({})
    renderApp(
      <SocketContext.Provider value={socket as never}>
        <NotificationToasts />
      </SocketContext.Provider>,
      opts()
    )

    act(() => socket.emit('notification', item({ id: 'a', kind: 'underAttack', category: 'attacks' })))
    act(() => socket.emit('notification', item({ id: 'a', kind: 'underAttack', category: 'attacks', count: 3 })))
    act(() => socket.emit('notification', item({ id: 'x', category: 'achievements', kind: 'achievementUnlocked' })))

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'a', message: 'Attacks', description: 'Your bot abcdef12 is under attack' })
    )
  })

  it('stops listening when it goes away, and waits for a connection', () => {
    const socket = fakeSocket()
    serve({})
    const { unmount } = renderApp(
      <SocketContext.Provider value={socket as never}>
        <NotificationToasts />
      </SocketContext.Provider>,
      opts()
    )
    unmount()
    expect(socket.off).toHaveBeenCalledWith('notification', expect.any(Function))

    renderApp(<NotificationToasts />, opts())
    expect(socket.on).toHaveBeenCalledTimes(1)
  })
})

describe('AwaySummary', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => jest.restoreAllMocks())

  it('sums up what waits unread once per visit', async () => {
    const info = jest.spyOn(notification, 'info').mockImplementation(() => undefined)
    serve({ '/notifications/summary': () => ({ unread: 12, byCategory: { attacks: 2, achievements: 1, damage: 9 } }) })
    const { unmount } = renderApp(<AwaySummary />, opts())

    await waitFor(() =>
      expect(info).toHaveBeenCalledWith({
        message: 'While you were away',
        description: '12 events, 2 attacks, 1 achievement'
      })
    )
    unmount()
    renderApp(<AwaySummary />, opts())
    await waitFor(() => expect(sessionStorage.getItem(AWAY_SHOWN_KEY)).toBe('1'))
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('says nothing when nothing waits, and leaves out what is zero', async () => {
    const info = jest.spyOn(notification, 'info').mockImplementation(() => undefined)
    serve({ '/notifications/summary': () => ({ unread: 0, byCategory: {} }) })
    const { unmount } = renderApp(<AwaySummary />, opts())
    await waitFor(() => expect(query).toHaveBeenCalled())
    expect(info).not.toHaveBeenCalled()
    unmount()

    serve({ '/notifications/summary': () => ({ unread: 1, byCategory: { damage: 1 } }) })
    renderApp(<AwaySummary />, opts())
    await waitFor(() => expect(info).toHaveBeenCalledWith(expect.objectContaining({ description: '1 event' })))
  })

  it('works when the browser storage is blocked', async () => {
    const options = opts()
    const info = jest.spyOn(notification, 'info').mockImplementation(() => undefined)
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    serve({ '/notifications/summary': () => ({ unread: 2, byCategory: {} }) })

    renderApp(<AwaySummary />, options)

    await waitFor(() => expect(info).toHaveBeenCalled())
  })
})

describe('NotificationPreferences', () => {
  it('has a switch for every category, and a change goes to the server', async () => {
    const calls = serve({
      '/notifications/preferences': (call) =>
        call.method === 'PATCH'
          ? { categories: {} }
          : {
              categories: {
                attacks: true,
                damage: true,
                scripts: false,
                security: true,
                fabrication: true,
                trade: true,
                achievements: true,
                system: true
              }
            }
    })
    renderApp(<NotificationPreferences />, opts())

    const scripts = await screen.findByRole('switch', { name: 'Notify about Scripts' })
    expect(scripts).not.toBeChecked()
    expect(screen.getAllByRole('switch')).toHaveLength(8)
    fireEvent.click(scripts)

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ categories: { scripts: true } })
    )
  })

  it('shows nothing until the preferences are known', () => {
    query.mockImplementation(() => new Promise(() => undefined) as never)

    const { container } = renderApp(<NotificationPreferences />, opts())

    expect(container).toBeEmptyDOMElement()
  })
})
