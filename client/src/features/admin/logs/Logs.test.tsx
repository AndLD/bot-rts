import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import AuditViewer from './AuditViewer'
import LogSearch from './LogSearch'
import LogsPage from './LogsPage'
import SlowTicks from './SlowTicks'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; params?: Record<string, unknown> }

const entry = (overrides = {}) => ({
  _id: 'a1',
  at: Date.UTC(2026, 5, 1, 12),
  actorId: '11111111-1111-1111-1111-111111111111',
  actorRole: 'admin',
  action: 'players.ban',
  outcome: 'success',
  targetType: 'player',
  targetId: 'p1',
  reason: 'spam',
  before: { status: 'user' },
  after: { status: 'banned' },
  ip: null,
  requestId: null,
  ...overrides
})

const TRACE_ID = 'a'.repeat(32)

const trace = (overrides = {}) => ({
  traceId: TRACE_ID,
  store: 'elasticsearch',
  isLogCut: false,
  spans: [
    {
      spanId: 'child',
      parentSpanId: 'root',
      name: 'engine act',
      kind: 'server',
      service: null,
      node: 'host:2',
      startedAt: Date.UTC(2026, 5, 1, 12, 0, 0, 10),
      durationMs: 20,
      status: 'error'
    },
    {
      spanId: 'root',
      parentSpanId: null,
      name: 'POST /api/v1/bots/:id/scan',
      kind: 'server',
      service: 'botrts-api',
      node: 'host:1',
      startedAt: Date.UTC(2026, 5, 1, 12, 0, 0, 0),
      durationMs: 150,
      status: 'ok'
    },
    {
      spanId: 'unknown-node',
      parentSpanId: 'root',
      name: 'notify',
      kind: 'consumer',
      service: null,
      node: null,
      startedAt: Date.UTC(2026, 5, 1, 12, 0, 0, 30),
      durationMs: 5,
      status: 'unset'
    }
  ],
  logs: [
    {
      at: Date.UTC(2026, 5, 1, 12, 0, 0, 5),
      level: 'info',
      message: 'the API handled the scan',
      requestId: TRACE_ID,
      traceId: TRACE_ID,
      node: 'host:1',
      service: 'botrts-api'
    },
    {
      at: Date.UTC(2026, 5, 1, 12, 0, 0, 15),
      level: 'error',
      message: 'the engine failed the scan',
      requestId: null,
      traceId: TRACE_ID,
      node: 'host:3',
      service: null
    },
    {
      at: Date.UTC(2026, 5, 1, 12, 0, 0, 25),
      level: 'warn',
      message: 'a line of an unknown node',
      requestId: null,
      traceId: TRACE_ID,
      node: null,
      service: null
    }
  ],
  ...overrides
})

function serve(handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/logs') {
      return {
        data: {
          lines: [
            {
              at: Date.UTC(2026, 5, 1, 12),
              level: 'warn',
              message: 'slow query for bot b1',
              requestId: 'req-1',
              traceId: 'a'.repeat(32),
              node: 'host:1',
              service: 'botrts-api'
            },
            {
              at: Date.UTC(2026, 5, 1, 11),
              level: 'info',
              message: 'started',
              requestId: null,
              traceId: null,
              node: null,
              service: null
            }
          ],
          total: 9,
          capacity: 5000,
          store: 'memory'
        }
      }
    }
    if (args.url.startsWith('/api/v1/admin/traces/')) {
      return { data: trace() }
    }
    if (args.url === '/api/v1/admin/logs/nodes') {
      return { data: [{ id: 'host:1', services: ['botrts-api', 'botrts-engine'] }] }
    }
    if (args.url === '/api/v1/admin/logs/slow-queries') {
      return {
        data: [{ at: Date.UTC(2026, 5, 1, 12), durationMs: 812.4, statement: 'SELECT * FROM "users" WHERE "id" = $1' }]
      }
    }
    if (args.url === '/api/v1/admin/logs/slow-ticks') {
      return {
        data: [
          { tick: 5, durationMs: 120.4, intervalMs: 100, isCut: false, queuedExecutions: 0, deferredExecutions: 0 },
          { tick: 9, durationMs: 180, intervalMs: 100, isCut: true, queuedExecutions: 2, deferredExecutions: 3 }
        ]
      }
    }
    if (args.url === '/api/v1/admin/audit') {
      return {
        data: {
          result: [
            entry(),
            entry({ _id: 'a2', outcome: 'denied', before: null, after: null, targetId: null, reason: null }),
            entry({ _id: 'a3', action: 'cell.touch', targetType: null, targetId: 'c1', before: null, after: null })
          ],
          meta: { pagination: { page: 1, results: 25, total: 60 } }
        }
      }
    }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role'], ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          {ui}
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

beforeEach(() => jest.clearAllMocks())

describe('LogSearch', () => {
  it('lists the newest lines with their level and request, and says how many match', async () => {
    serve()
    renderAs('admin', <LogSearch />)

    expect(await screen.findByText('slow query for bot b1')).toBeInTheDocument()
    expect(screen.getByText('a'.repeat(32))).toBeInTheDocument()
    expect(screen.getByText('host:1 · botrts-api')).toBeInTheDocument()
    expect(screen.getByText('warn')).toBeInTheDocument()
    expect(screen.getByText('2 of 9 matching lines (the node keeps the newest 5000)')).toBeInTheDocument()
  })

  it('searches by text and by request, and refreshes', async () => {
    const calls = serve()
    renderAs('admin', <LogSearch />)
    await screen.findByText('started')

    fireEvent.change(screen.getByPlaceholderText('Text, or the id of a player or a bot'), {
      target: { value: 'bot b1' }
    })
    fireEvent.change(screen.getByPlaceholderText('Request id'), { target: { value: 'req-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(calls.some((call) => call.params?.q === 'bot b1' && call.params?.requestId === 'req-1')).toBe(true)
    )

    const before = calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(calls.length).toBeGreaterThan(before))
  })

  it('searches by trace, player, bot and node, and clears the filters it leaves empty', async () => {
    const calls = serve()
    renderAs('admin', <LogSearch />)
    await screen.findByText('started')
    const ids = { user: '11111111-1111-4111-8111-111111111111', bot: '22222222-2222-4222-8222-222222222222' }

    fireEvent.change(screen.getByPlaceholderText('Trace id'), { target: { value: 'b'.repeat(32) } })
    fireEvent.change(screen.getByPlaceholderText('Player id'), { target: { value: ids.user } })
    fireEvent.change(screen.getByPlaceholderText('Bot id'), { target: { value: ids.bot } })
    fireEvent.mouseDown(screen.getByText('All nodes'))
    fireEvent.click(await screen.findByText('host:1 (botrts-api, botrts-engine)'))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.params?.traceId === 'b'.repeat(32) &&
            call.params?.userId === ids.user &&
            call.params?.botId === ids.bot &&
            call.params?.node === 'host:1'
        )
      ).toBe(true)
    )
  })

  it('reads the log store of every node: says so, and asks for older lines a page at a time', async () => {
    const calls = serve((call) =>
      call.url === '/api/v1/admin/logs'
        ? {
            data: {
              lines: Array.from({ length: call.params?.results as number }, (_, n) => ({
                at: 1000 - n,
                level: 'info',
                message: `line ${n}`,
                requestId: null,
                traceId: null,
                node: 'host:2',
                service: n === 0 ? null : 'botrts-engine'
              })),
              total: 1000,
              capacity: null,
              store: 'elasticsearch'
            }
          }
        : undefined
    )
    renderAs('admin', <LogSearch />)

    expect(await screen.findByText('100 of 1000 matching lines from the log store')).toBeInTheDocument()
    expect(screen.getByText('host:2 ·')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Older lines' }))

    expect(await screen.findByText('200 of 1000 matching lines from the log store')).toBeInTheDocument()
    expect(calls.some((call) => call.params?.results === 200)).toBe(true)
  })

  it('opens the trace of a line: the spans as a tree on a timeline, and every line of the trace', async () => {
    const calls = serve()
    renderAs('admin', <LogSearch />)
    await screen.findByText('slow query for bot b1')

    fireEvent.click(screen.getAllByRole('button', { name: 'Open trace' })[1])

    expect(await screen.findByText('POST /api/v1/bots/:id/scan')).toBeInTheDocument()
    expect(calls.some((call) => call.url === `/api/v1/admin/traces/${TRACE_ID}`)).toBe(true)
    const names = Array.from(document.querySelectorAll('.ant-drawer tbody tr td:first-child'))
      .map((cell) => cell.textContent)
      .filter((text) => text === 'engine act' || text?.startsWith('POST'))
    expect(names).toEqual(['POST /api/v1/bots/:id/scan', 'engine act'])
    expect(screen.getByText('+10.0 ms')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'engine act 20.0 ms' })).toBeInTheDocument()
    expect(screen.getAllByText('error', { selector: '.ant-drawer .ant-tag' })).toHaveLength(2)
    expect(screen.getByText('the API handled the scan')).toBeInTheDocument()
    expect(screen.getByText('the engine failed the scan')).toBeInTheDocument()
    expect(screen.getByText('150 ms', { selector: '.ant-descriptions-item-content' })).toBeInTheDocument()
    expect(screen.getAllByText('host:2 ·').length).toBeGreaterThan(0)
    expect(screen.getByText('host:3 ·')).toBeInTheDocument()

    fireEvent.click(document.querySelector('.ant-drawer-close') as Element)
    await waitFor(() => expect(screen.queryByText('the API handled the scan')).toBeNull())
  })

  it('opens a trace by an id typed in, ignores a bad one, and explains a trace without spans or with cut lines', async () => {
    serve((call) =>
      call.url === '/api/v1/admin/traces/old-request'
        ? { data: trace({ store: 'memory', spans: [], isLogCut: true }) }
        : call.url === '/api/v1/admin/traces/unsampled'
          ? { data: trace({ spans: [] }) }
          : undefined
    )
    renderAs('admin', <LogSearch />)
    await screen.findByText('started')
    const box = screen.getByPlaceholderText('Trace id, or the request id of an older line')
    const searchButton = () => document.querySelector('.ant-input-search-button') as Element

    fireEvent.change(box, { target: { value: 'not valid!' } })
    fireEvent.click(searchButton())
    expect(document.querySelector('.ant-drawer')).toBeNull()

    fireEvent.change(box, { target: { value: 'old-request' } })
    fireEvent.click(searchButton())
    expect(await screen.findByText(/keeps the log lines of a trace, not its spans/)).toBeInTheDocument()
    expect(screen.getByText(/more lines than fit here/)).toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'unsampled' } })
    fireEvent.click(searchButton())
    expect(await screen.findByText(/No spans were stored for this trace/)).toBeInTheDocument()
  })

  it('says so when the trace cannot be loaded', async () => {
    serve((call) => (call.url.startsWith('/api/v1/admin/traces/') ? { error: { status: 404, data: {} } } : undefined))
    renderAs('admin', <LogSearch />)
    await screen.findByText('slow query for bot b1')

    fireEvent.click(screen.getAllByRole('button', { name: 'Open trace' })[1])

    expect(await screen.findByText('Could not load the trace')).toBeInTheDocument()
  })

  it('says so when the log cannot be loaded', async () => {
    serve((call) => (call.url === '/api/v1/admin/logs' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('admin', <LogSearch />)

    expect(await screen.findByText('Could not load the log')).toBeInTheDocument()
  })
})

describe('SlowTicks', () => {
  it('lists the slow ticks, the newest first', async () => {
    serve()
    renderAs('admin', <SlowTicks />)

    expect(await screen.findByText('180 / 100 ms')).toBeInTheDocument()
    const ticks = Array.from(
      document.querySelectorAll('.ant-table')[0].querySelectorAll('tbody tr td:first-child')
    ).map((cell) => cell.textContent)
    expect(ticks).toEqual(['9', '5'])
    expect(screen.getByText('yes')).toBeInTheDocument()
    expect(await screen.findByText('812 ms')).toBeInTheDocument()
    expect(screen.getByText('SELECT * FROM "users" WHERE "id" = $1')).toBeInTheDocument()
  })

  it('says there are none, and when they cannot be loaded', async () => {
    serve((call) => (call.url.endsWith('/slow-ticks') ? { data: [] } : undefined))
    const { unmount } = renderAs('admin', <SlowTicks />)
    expect(await screen.findByText('No slow ticks')).toBeInTheDocument()
    expect(await screen.findByText('No slow queries')).toBeInTheDocument()
    unmount()

    serve((call) => (call.url.endsWith('/slow-ticks') ? { error: { status: 503, data: {} } } : undefined))
    renderAs('admin', <SlowTicks />)
    expect(await screen.findByText('Could not load the slow ticks')).toBeInTheDocument()
  })
})

describe('AuditViewer', () => {
  it('lists the trail with the outcome and target, and expands the before and after of a change', async () => {
    serve()
    renderAs('admin', <AuditViewer />)

    expect(await screen.findAllByText('players.ban')).toHaveLength(2)
    expect(screen.getByText('player p1')).toBeInTheDocument()
    expect(screen.getByText('denied')).toBeInTheDocument()
    expect(document.querySelectorAll('.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)')).toHaveLength(
      1
    )

    fireEvent.click(
      document.querySelector('.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)') as Element
    )
    expect(await screen.findByText(/"status": "banned"/)).toBeInTheDocument()
  })

  it('filters by the fields and by dates, and goes to another page', async () => {
    const calls = serve()
    renderAs('admin', <AuditViewer />)
    await screen.findAllByText('players.ban')

    fireEvent.change(screen.getByPlaceholderText('Action'), { target: { value: 'players.ban' } })
    fireEvent.change(screen.getByPlaceholderText('Target id'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-06-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.params?.action === 'players.ban' &&
            call.params?.targetId === 'p1' &&
            call.params?.from === '2026-06-01T00:00:00.000Z' &&
            call.params?.to === '2026-06-02T23:59:59.999Z'
        )
      ).toBe(true)
    )
    fireEvent.click(await screen.findByTitle('2'))
    await waitFor(() => expect(calls.some((call) => call.params?.page === 2)).toBe(true))
  })

  it('filters without dates, and shows a target that names no type', async () => {
    const calls = serve()
    renderAs('admin', <AuditViewer />)
    expect(await screen.findByText('c1')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Action'), { target: { value: 'cell.touch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))

    await waitFor(() =>
      expect(calls.some((call) => call.params?.action === 'cell.touch' && call.params?.from === undefined)).toBe(true)
    )
  })

  it('says so when the trail cannot be loaded', async () => {
    serve((call) => (call.url === '/api/v1/admin/audit' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('admin', <AuditViewer />)

    expect(await screen.findByText('Could not load the audit log')).toBeInTheDocument()
  })
})

// jsdom has no fetch Response; the page only needs these
const answer = (ok: boolean, body: unknown) => ({
  ok,
  blob: async () => new Blob(['time,actor\n']),
  json: async () => {
    if (body === undefined) throw new SyntaxError('not JSON')
    return body
  }
})

describe('the audit export', () => {
  const originalFetch = global.fetch
  const click = jest.fn()
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:csv')
    URL.revokeObjectURL = jest.fn()
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
  })
  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('downloads the trail as a file, with the token of the session', async () => {
    serve()
    global.fetch = jest.fn(async () => answer(true, undefined)) as never
    renderAs('admin', <AuditViewer />)
    await screen.findAllByText('players.ban')
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/admin/audit/export?')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: expect.stringMatching(/^Bearer /) })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv')
  })

  it('tells why the export was refused', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve()
    global.fetch = jest.fn(async () => answer(false, { code: 'FORBIDDEN' })) as never
    renderAs('owner', <AuditViewer />)
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'You are not allowed to do this' }))
    )
    expect(click).not.toHaveBeenCalled()
  })

  it('survives an answer that is not JSON', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve()
    global.fetch = jest.fn(async () => answer(false, undefined)) as never
    renderAs('admin', <AuditViewer />)
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Something went wrong' }))
    )
  })

  it('offers no export to a role without the permission', async () => {
    serve()
    renderAs('moderator', <AuditViewer />)
    await screen.findAllByText('players.ban')

    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  })
})

describe('LogsPage', () => {
  it('shows an admin all three tabs and a moderator none', async () => {
    serve()
    const { unmount } = renderAs('admin', <LogsPage />)
    expect(await screen.findByText('Audit')).toBeInTheDocument()
    expect(screen.getByText('Application log')).toBeInTheDocument()
    expect(screen.getByText('Slow ticks')).toBeInTheDocument()
    unmount()

    renderAs('moderator', <LogsPage />)
    expect(screen.queryByText('Audit')).toBeNull()
    expect(screen.queryByText('Application log')).toBeNull()
  })
})
