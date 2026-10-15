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
            { at: Date.UTC(2026, 5, 1, 12), level: 'warn', message: 'slow query for bot b1', requestId: 'req-1' },
            { at: Date.UTC(2026, 5, 1, 11), level: 'info', message: 'started', requestId: null }
          ],
          total: 9,
          capacity: 5000
        }
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
            entry({ _id: 'a2', outcome: 'denied', before: null, after: null, targetId: null, reason: null })
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
    expect(screen.getByText('req-1')).toBeInTheDocument()
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
    const ticks = Array.from(document.querySelectorAll('tbody tr td:first-child')).map((cell) => cell.textContent)
    expect(ticks).toEqual(['9', '5'])
    expect(screen.getByText('yes')).toBeInTheDocument()
  })

  it('says there are none, and when they cannot be loaded', async () => {
    serve((call) => (call.url.endsWith('/slow-ticks') ? { data: [] } : undefined))
    const { unmount } = renderAs('admin', <SlowTicks />)
    expect(await screen.findByText('No slow ticks')).toBeInTheDocument()
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
