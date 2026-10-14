import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { IInspectorBot } from '@lib/utils/admin-inspector'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import BotInspectorPage from './BotInspectorPage'
import FileBrowser from './FileBrowser'
import HeatGrid from './HeatGrid'
import InspectorPage from './InspectorPage'
import WorldMapPage from './WorldMapPage'

const push = jest.fn()
let search = ''
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'bot-1' }),
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search)
}))
jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

// The canvas needs a browser; the page's own wiring is what is tested: the loader it builds, the centre, the click on a bot
type MapProps = {
  loader: { ensure: (range: object) => Promise<void> }
  center?: { x: number; y: number }
  onOpenBot?: (id: string) => void
}
let mapProps: MapProps | null = null
jest.mock('../../map/MapCanvas', () => ({
  __esModule: true,
  default: (props: MapProps) => {
    mapProps = props
    return <div data-testid="map" />
  }
}))
jest.mock('../../map/useReducedMotion', () => ({ useReducedMotion: () => false }))

type Handler = (...args: unknown[]) => void
const sockets: Array<{
  handlers: Record<string, Handler>
  disconnect: jest.Mock
  url: string
  options: Record<string, unknown>
}> = []
jest.mock('socket.io-client', () => ({
  io: (url: string, options: Record<string, unknown>) => {
    const socket = {
      handlers: {} as Record<string, Handler>,
      disconnect: jest.fn(),
      url,
      options,
      on: (event: string, handler: Handler) => (socket.handlers[event] = handler)
    }
    sockets.push(socket)
    return socket
  }
}))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; params?: Record<string, unknown> }

const bot = (overrides: Partial<IInspectorBot> = {}): IInspectorBot => ({
  _id: 'bot-1',
  label: 'Home',
  type: 'base',
  ownerId: 'owner-1',
  ownerName: 'Alice',
  baseId: null,
  position: { x: 3, y: 4 },
  heading: 0,
  energy: { stored: 40.4, capacity: 100 },
  storage: [{ resource: 'iron', amount: 8 }],
  modules: [
    {
      _id: 'm1',
      type: 'battery',
      name: 'cell',
      condition: 90,
      maxCondition: 100,
      weight: 5,
      props: { capacity: '100' }
    }
  ],
  drives: [{ _id: 'd1', name: 'main', quota: 1000, usedBytes: 19 }],
  executions: [
    { _id: 'e1', file: '/main/run.js', status: 'active', restarts: 1, reason: null, createdAt: 1000, endedAt: null }
  ],
  logs: [{ at: 2000, kind: 'output', text: 'hello admin' }],
  ...overrides
})

function serve(handler: (call: Call) => unknown = () => undefined, data: { bot?: IInspectorBot } = {}) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/inspector/bots/bot-1') return { data: data.bot ?? bot() }
    if (args.url.endsWith('/drives/d1/files')) {
      return {
        data: args.params?.dir
          ? [{ path: 'lib/util.js', kind: 'file', size: 1 }]
          : [
              { path: 'lib', kind: 'directory', size: 0 },
              { path: 'run.js', kind: 'file', size: 10 }
            ]
      }
    }
    if (args.url.endsWith('/drives/d1/file'))
      return { data: { path: String(args.params?.path), size: 10, content: 'bot.log("hi")' } }
    if (args.url.endsWith('/inspector/heatmap')) {
      return {
        data: {
          kind: args.params?.kind,
          bucket: args.params?.bucket,
          buckets: [{ x: 0, y: 0, intensity: 1, value: 3 }]
        }
      }
    }
    if (args.url.endsWith('/inspector/map')) return { data: { now: 1, cells: [], liveAreas: [] } }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role'], ui: React.ReactNode, token: string | null = makeJwt(60)) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(token)}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          {ui}
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sockets.length = 0
  mapProps = null
  search = ''
})

describe('InspectorPage', () => {
  it('shows nothing until a search is made, then lists the results with links by kind', async () => {
    const calls = serve((call) =>
      call.url.endsWith('/search')
        ? {
            data: [
              { kind: 'base', id: 'b1', label: 'Home', x: 3, y: 4 },
              { kind: 'bot', id: 'b2', label: 'Scout', x: null, y: null },
              { kind: 'player', id: 'p1', label: 'Alice', x: null, y: null },
              { kind: 'cell', id: 'b3', label: 'bot', x: 9, y: 9 },
              { kind: 'cell', id: null, label: 'empty', x: 1, y: 2 }
            ]
          }
        : undefined
    )
    renderAs('moderator', <InspectorPage />)
    expect(calls).toHaveLength(0)

    const input = screen.getByPlaceholderText('Id of a bot, base or player, or a cell like 12,-4')
    fireEvent.change(input, { target: { value: 'home' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })

    expect(await screen.findByRole('link', { name: 'Home' })).toHaveAttribute('href', '/admin/inspector/b1')
    expect(screen.getByRole('link', { name: 'Scout' })).toHaveAttribute('href', '/admin/inspector/b2')
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/admin/players/p1')
    expect(screen.getByRole('link', { name: 'bot' })).toHaveAttribute('href', '/admin/inspector/b3')
    expect(screen.getByRole('link', { name: 'empty' })).toHaveAttribute('href', '/admin/map?x=1&y=2')
    expect(screen.getByText('(3, 4)')).toBeInTheDocument()
  })

  it('says nothing was found, and tells why a search was refused', async () => {
    serve((call) => (call.url.endsWith('/search') ? { data: [] } : undefined))
    const { unmount } = renderAs('moderator', <InspectorPage />)
    const input = screen.getByPlaceholderText('Id of a bot, base or player, or a cell like 12,-4')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(await screen.findByText('Nothing found')).toBeInTheDocument()
    unmount()

    serve((call) =>
      call.url.endsWith('/search') ? { error: { status: 400, data: { code: 'VALIDATION_FAILED' } } } : undefined
    )
    renderAs('moderator', <InspectorPage />)
    const second = screen.getByPlaceholderText('Id of a bot, base or player, or a cell like 12,-4')
    fireEvent.change(second, { target: { value: 'abc' } })
    fireEvent.keyDown(second, { key: 'Enter', keyCode: 13 })
    expect(await screen.findByText('Please check the entered data')).toBeInTheDocument()
  })
})

describe('BotInspectorPage', () => {
  it('shows the bot: owner, place, energy, storage, modules, executions and logs', async () => {
    serve()
    renderAs('moderator', <BotInspectorPage />)

    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/admin/players/owner-1')
    expect(screen.getByRole('link', { name: '(3, 4)' })).toHaveAttribute('href', '/admin/map?x=3&y=4')
    expect(screen.getByText('40 / 100')).toBeInTheDocument()
    expect(screen.getByText('iron: 8')).toBeInTheDocument()
    expect(screen.getByText('capacity=100')).toBeInTheDocument()
    expect(screen.getByText('90 / 100')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Executions'))
    expect(await screen.findByText('/main/run.js')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Terminal log'))
    expect(await screen.findByText(/\[output\] hello admin/)).toBeInTheDocument()
  })

  it('shows a worker with its base, and dashes for what is missing', async () => {
    serve(undefined, {
      bot: bot({
        type: 'worker',
        label: null,
        ownerId: null,
        ownerName: null,
        baseId: 'base-9',
        position: null,
        storage: [],
        drives: [],
        executions: [],
        logs: []
      })
    })
    renderAs('moderator', <BotInspectorPage />)

    expect(await screen.findByText('bot-1')).toBeInTheDocument()
    expect(screen.getByText('Not on the map')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'base-9' })).toHaveAttribute('href', '/admin/inspector/base-9')
    fireEvent.click(screen.getByText('Executions'))
    fireEvent.click(screen.getByText('Terminal log'))
    fireEvent.click(screen.getByText('Drives and files'))
    expect(screen.getAllByText('–').length).toBeGreaterThan(0)
  })

  it('says so when the bot cannot be loaded', async () => {
    serve((call) => (call.url.endsWith('/bots/bot-1') ? { error: { status: 404, data: {} } } : undefined))
    renderAs('moderator', <BotInspectorPage />)

    expect(await screen.findByText('Could not load the bot')).toBeInTheDocument()
  })
})

describe('FileBrowser', () => {
  // The browser alone: a whole inspector page is a large DOM and slow to query
  async function openFiles(role: IAdminMe['role']) {
    renderAs(role, <FileBrowser botId="bot-1" driveId="d1" />)
  }

  it('lists the files and goes into a directory and back', async () => {
    const calls = serve()
    await openFiles('moderator')

    fireEvent.click(await screen.findByRole('button', { name: /lib/ }))
    expect(await screen.findByText('lib/util.js')).toBeInTheDocument()
    expect(calls.some((call) => call.params?.dir === 'lib')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /← lib/ }))
    expect(await screen.findByText('run.js')).toBeInTheDocument()
    // A moderator may look at the listing, not open a file
    expect(screen.queryByRole('button', { name: 'Open (audited)' })).toBeNull()
  })

  it('goes up one level from a nested directory', async () => {
    serve((call) =>
      call.url.endsWith('/drives/d1/files')
        ? {
            data:
              call.params?.dir === 'a/b'
                ? [{ path: 'a/b/x.js', kind: 'file', size: 1 }]
                : call.params?.dir === 'a'
                  ? [{ path: 'a/b', kind: 'directory', size: 0 }]
                  : [{ path: 'a', kind: 'directory', size: 0 }]
          }
        : undefined
    )
    await openFiles('moderator')
    fireEvent.click(await screen.findByRole('button', { name: /📁 a$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /a\/b/ }))
    expect(await screen.findByText('a/b/x.js')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /← a\/b/ }))
    expect(await screen.findByRole('button', { name: /← a$/ })).toBeInTheDocument()
  })

  it('opens a file for an admin who may, and closes it', async () => {
    const calls = serve()
    await openFiles('admin')
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open (audited)' }))[0])

    expect(await screen.findByText('bot.log("hi")')).toBeInTheDocument()
    expect(calls.find((call) => call.url.endsWith('/file'))?.params).toMatchObject({ path: 'run.js' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('bot.log("hi")')).not.toBeVisible())
  })

  it('tells why a file could not be opened', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve((call) => (call.url.endsWith('/file') ? { error: { status: 404, data: { code: 'NOT_FOUND' } } } : undefined))
    await openFiles('admin')
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open (audited)' }))[0])

    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not found' })))
  })
})

describe('HeatGrid', () => {
  it('draws a square per bucket, brighter where it is busier', () => {
    const { container } = render(
      <HeatGrid
        label="Density"
        area={{ minX: 0, minY: 0, side: 32 }}
        heatmap={{
          kind: 'density',
          bucket: 16,
          buckets: [
            { x: 0, y: 0, value: 4, intensity: 1 },
            { x: 16, y: 16, value: 1, intensity: 0.25 }
          ]
        }}
      />
    )

    const squares = container.querySelectorAll('rect')
    expect(squares).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Density' })).toBeInTheDocument()
    expect(squares[0].getAttribute('fill-opacity')).toBe('1')
    expect(Number(squares[1].getAttribute('fill-opacity'))).toBeCloseTo(0.3625)
    expect(squares[1].getAttribute('x')).toBe('16')
  })
})

describe('WorldMapPage', () => {
  it('opens the map on the cell asked for and a bot click opens its inspector', async () => {
    search = 'x=40&y=-8'
    serve()
    renderAs('moderator', <WorldMapPage />)

    expect(await screen.findByTestId('map')).toBeInTheDocument()
    expect(mapProps?.center).toEqual({ x: 40, y: -8 })
    act(() => mapProps?.onOpenBot?.('bot-7'))
    expect(push).toHaveBeenCalledWith('/admin/inspector/bot-7')
  })

  it('asks the server for the map tiles through the loader', async () => {
    const calls = serve()
    renderAs('moderator', <WorldMapPage />)
    await screen.findByTestId('map')

    await mapProps?.loader.ensure({ minX: 0, minY: 0, maxX: 10, maxY: 10 })

    expect(calls.some((call) => call.url.endsWith('/inspector/map'))).toBe(true)
  })

  it('centres on the origin when the address has no place, and draws the heatmap of a kind and bucket', async () => {
    search = 'x=abc'
    const calls = serve()
    renderAs('moderator', <WorldMapPage />)
    await screen.findByTestId('map')

    expect(mapProps?.center).toEqual({ x: 0, y: 0 })
    expect(await screen.findByRole('img', { name: 'Density' })).toBeInTheDocument()
    expect(calls.find((call) => call.url.endsWith('/heatmap'))?.params).toMatchObject({
      minX: -128,
      maxX: 127,
      kind: 'density',
      bucket: 16
    })

    fireEvent.click(screen.getByText('Depletion'))
    await waitFor(() => expect(calls.some((call) => call.params?.kind === 'depletion')).toBe(true))
    fireEvent.mouseDown(document.querySelector('.ant-select-selector') as Element)
    fireEvent.click(await screen.findByText('32 cells', { selector: '.ant-select-item-option-content' }))
    await waitFor(() => expect(calls.some((call) => call.params?.bucket === 32)).toBe(true))
  })

  it('does not listen for events without a session', async () => {
    serve()
    renderAs('moderator', <WorldMapPage />, null)
    await screen.findByTestId('map')

    expect(sockets).toHaveLength(0)
  })

  it('lists the game events pushed over the admin namespace, newest first, and stops listening', async () => {
    serve()
    const { unmount } = renderAs('moderator', <WorldMapPage />)
    expect(await screen.findByText('No events yet')).toBeInTheDocument()
    expect(sockets[0].url).toBe('http://api.test/admin')
    const authenticate = sockets[0].options.auth as (callback: (data: unknown) => void) => void
    const given = jest.fn()
    authenticate(given)
    expect(given).toHaveBeenCalledWith({ token: expect.any(String) })

    act(() =>
      sockets[0].handlers['game-event-tail']({
        userId: 'abcdef12-0000-0000-0000-000000000000',
        event: { type: 'EnergyLow', at: 1, parties: [], location: { x: 5, y: 6, z: 0 } }
      })
    )
    act(() =>
      sockets[0].handlers['game-event-tail']({
        userId: '12345678-0000-0000-0000-000000000000',
        event: { type: 'ScanCompleted', at: 2, parties: [] }
      })
    )

    const items = await screen.findAllByText(/·/)
    expect(items.map((item) => item.textContent)).toEqual(['ScanCompleted · 12345678', 'EnergyLow · abcdef12 · (5, 6)'])
    unmount()
    expect(sockets[0].disconnect).toHaveBeenCalled()
  })
})
