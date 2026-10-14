import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import { act } from 'react'
import { IAdminMe, IHealthReport } from '@lib/utils/admin'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import AdminDashboard from './AdminDashboard'
import LineChart from './LineChart'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

type Handler = (...args: unknown[]) => void
const sockets: Array<{
  handlers: Record<string, Handler>
  disconnect: jest.Mock
  options: Record<string, unknown>
  url: string
}> = []
jest.mock('socket.io-client', () => ({
  io: (url: string, options: Record<string, unknown>) => {
    const socket = {
      handlers: {} as Record<string, Handler>,
      disconnect: jest.fn(),
      options,
      url,
      on: (event: string, handler: Handler) => (socket.handlers[event] = handler)
    }
    sockets.push(socket)
    return socket
  }
}))

const query = jest.mocked(baseQueryWithRefresh)

const health = (overrides: Partial<IHealthReport> = {}): IHealthReport => ({
  sampledAt: 1000,
  status: 'yellow',
  areas: [
    {
      area: 'engine',
      status: 'yellow',
      metrics: [{ id: 'engine.tickP95Ms', area: 'engine', unit: 'ms', value: 42.5, status: 'yellow' }]
    },
    {
      area: 'scripts',
      status: 'green',
      metrics: [{ id: 'scripts.running', area: 'scripts', unit: 'count', value: 3, status: 'green' }]
    },
    {
      area: 'api',
      status: 'green',
      metrics: [{ id: 'api.latencyP95Ms', area: 'api', unit: 'ms', value: null, status: 'green' }]
    },
    { area: 'infrastructure', status: 'green', metrics: [] }
  ],
  alerts: [
    {
      _id: 'a1',
      metric: 'engine.tickP95Ratio',
      area: 'engine',
      severity: 'yellow',
      value: 0.9,
      threshold: 0.8,
      openedAt: 1,
      clearedAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null
    },
    {
      _id: 'a2',
      metric: 'engine.up',
      area: 'engine',
      severity: 'red',
      value: 0,
      threshold: 1,
      openedAt: 1,
      clearedAt: null,
      acknowledgedAt: 5,
      acknowledgedBy: 'x'
    }
  ],
  ...overrides
})

const me = (role: IAdminMe['role']): IAdminMe => ({
  role,
  permissions: [],
  twoFactor: { isEnrolled: true, isVerified: true }
})

type Call = { url: string; method?: string; params?: Record<string, string> }

function serve(report: IHealthReport | 'broken', onCall: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = onCall(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/monitoring/health') {
      return report === 'broken' ? { error: { status: 500, data: {} } } : { data: report }
    }
    if (args.url === '/api/v1/admin/monitoring/series') {
      return args.params?.metric === 'scripts.running'
        ? { data: { metric: 'scripts.running', stepMs: 10000, points: [] } }
        : {
            data: {
              metric: args.params?.metric,
              stepMs: 10000,
              points: [
                [1000, 1],
                [2000, 3]
              ]
            }
          }
    }
    return { data: {} }
  }) as never)

  return calls
}

function renderDashboard(role: IAdminMe['role'] = 'owner', token: string | null = makeJwt(60)) {
  const store = storeWithToken(token)

  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={store}>
        <AdminMeContext.Provider value={me(role)}>
          <AdminDashboard />
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sockets.length = 0
    localStorage.clear()
  })

  it('shows a tile and status per area, the headline value, and the alerts', async () => {
    serve(health())
    renderDashboard()

    expect(
      await screen.findByText('Tick duration, 95th percentile', { selector: '.ant-statistic-title' })
    ).toBeInTheDocument()
    expect(screen.getByText('42.5 ms')).toBeInTheDocument()
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0)
    expect(screen.getByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('Infrastructure')).toBeInTheDocument()
    expect(screen.getByText('Tick duration vs the interval')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })

  it('draws a chart for a metric with data and says so for one without', async () => {
    serve(health())
    renderDashboard()

    expect((await screen.findAllByRole('img', { name: 'Tick duration, 95th percentile' })).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBeGreaterThan(0))
  })

  it('reads the series again for another time range', async () => {
    const calls = serve(health())
    renderDashboard()
    await screen.findByText('42.5 ms')

    fireEvent.click(screen.getByText('24 hours'))

    await waitFor(() =>
      expect(calls.some((call) => call.url.endsWith('/series') && call.params?.range === '24h')).toBe(true)
    )
  })

  it('lets an admin with the permission acknowledge an alert, and not a moderator', async () => {
    const calls = serve(health())
    const { unmount } = renderDashboard('owner')
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }))

    await waitFor(() =>
      expect(calls.some((call) => call.url.endsWith('/alerts/a1/acknowledge') && call.method === 'POST')).toBe(true)
    )
    unmount()

    serve(health())
    renderDashboard('moderator')
    await screen.findByText('Tick duration vs the interval')
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull()
  })

  it('says there are no alerts', async () => {
    serve(health({ alerts: [], status: 'green' }))
    renderDashboard()

    expect(await screen.findByText('No open alerts')).toBeInTheDocument()
  })

  it('shows an error when the report cannot be loaded', async () => {
    serve('broken')
    renderDashboard()

    expect(await screen.findByText('Could not load the health report')).toBeInTheDocument()
  })

  it('waits for data before the first report', () => {
    serve(health())
    renderDashboard()

    expect(screen.getByText('Waiting for data')).toBeInTheDocument()
  })

  it('does not open the live connection without a session', () => {
    serve(health())
    renderDashboard('owner', null)

    expect(sockets).toHaveLength(0)
  })

  it('goes live over the admin namespace, takes pushed reports, and falls back to polling', async () => {
    serve(health({ status: 'green', alerts: [] }))
    const { unmount } = renderDashboard()
    await screen.findByText('Refreshing every 30 s')

    expect(sockets).toHaveLength(1)
    expect(sockets[0].url).toBe('http://api.test/admin')
    const authenticate = sockets[0].options.auth as (callback: (data: unknown) => void) => void
    const given = jest.fn()
    authenticate(given)
    expect(given).toHaveBeenCalledWith({ token: expect.any(String) })

    act(() => sockets[0].handlers.connect())
    expect(await screen.findByText('Live')).toBeInTheDocument()

    act(() => sockets[0].handlers['monitoring-health'](health({ status: 'red', alerts: [] })))
    expect(await screen.findAllByText('Critical')).not.toHaveLength(0)

    act(() => sockets[0].handlers.disconnect())
    expect(await screen.findByText('Refreshing every 30 s')).toBeInTheDocument()

    unmount()
    expect(sockets[0].disconnect).toHaveBeenCalled()
  })
})

describe('LineChart', () => {
  it('draws nothing but the frame without points, and a path with them', () => {
    const { container, rerender } = render(<LineChart points={[]} label="empty" format={String} />)
    expect(container.querySelector('path')).toBeNull()

    rerender(<LineChart points={[[0, 0]]} label="one" format={(value) => `max ${value}`} />)
    expect(container.querySelector('path')).not.toBeNull()
    rerender(
      <LineChart
        points={[
          [0, 1],
          [10, 5]
        ]}
        label="two"
        format={(value) => `max ${value}`}
      />
    )
    expect(screen.getByText('max 5')).toBeInTheDocument()
  })
})
