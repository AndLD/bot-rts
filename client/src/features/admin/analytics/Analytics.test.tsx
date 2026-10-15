import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAnalytics } from '@lib/utils/admin-analytics'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import AnalyticsPage from './AnalyticsPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; params?: Record<string, unknown> }

const report = (overrides: Partial<IAnalytics> = {}): IAnalytics => ({
  days: 30,
  players: 20,
  activity: {
    daily: [
      { day: '2026-06-01', users: 3 },
      { day: '2026-06-02', users: 5 }
    ],
    dau: 5,
    mau: 10
  },
  retention: [
    { cohort: '2026-05-25', size: 8, d1: 0.5, d7: null, d30: null },
    { cohort: '2026-05-18', size: 4, d1: 0.25, d7: 0.125, d30: 0 }
  ],
  funnel: [
    { step: 'signedUp', users: 10 },
    { step: 'verified', users: 8 },
    { step: 'baseDeployed', users: 6 },
    { step: 'firstScript', users: 4 },
    { step: 'firstResource', users: 3 },
    { step: 'tutorialCompleted', users: 2 }
  ],
  achievements: [{ id: 'firstSteps', unlocked: 12, share: 0.6 }],
  ...overrides
})

function serve(data: IAnalytics, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    return handler(args) ?? { data }
  }) as never)

  return calls
}

const renderPage = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AnalyticsPage />
      </Provider>
    </NextIntlClientProvider>
  )

const originalFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  URL.createObjectURL = jest.fn(() => 'blob:csv')
  URL.revokeObjectURL = jest.fn()
})
afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('AnalyticsPage', () => {
  it('shows the active players, the retention, the funnel and the achievements', async () => {
    serve(report())
    renderPage()

    expect(await screen.findByText('Active today')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Players active each day' })).toBeInTheDocument()
    expect(screen.getByText('2026-05-25')).toBeInTheDocument()
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('–').length).toBe(2)
    expect(screen.getByText('Email confirmed')).toBeInTheDocument()
    expect(screen.getByText('firstSteps')).toBeInTheDocument()
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0)
  })

  it('shows zero stickiness without monthly players, and an empty funnel', async () => {
    serve(
      report({
        players: 0,
        activity: { daily: [{ day: '2026-06-01', users: 0 }], dau: 0, mau: 0 },
        retention: [],
        funnel: [
          { step: 'signedUp', users: 0 },
          { step: 'verified', users: 0 },
          { step: 'baseDeployed', users: 0 },
          { step: 'firstScript', users: 0 },
          { step: 'firstResource', users: 0 },
          { step: 'tutorialCompleted', users: 0 }
        ],
        achievements: []
      })
    )
    renderPage()

    expect(await screen.findByText('No sign-ups in this period')).toBeInTheDocument()
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)
  })

  it('asks for another window', async () => {
    const calls = serve(report())
    renderPage()
    await screen.findByText('Active today')

    fireEvent.click(screen.getByText('90 days'))

    await waitFor(() => expect(calls.some((call) => call.params?.days === 90)).toBe(true))
  })

  it('says so when the analytics cannot be loaded', async () => {
    serve(report(), () => ({ error: { status: 500, data: {} } }))
    renderPage()

    expect(await screen.findByText('Could not load the analytics')).toBeInTheDocument()
  })

  it('downloads a report as a file, with the window', async () => {
    serve(report())
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) })) as never
    renderPage()
    await screen.findByText('Active today')

    fireEvent.click(screen.getAllByRole('button', { name: 'Download CSV' })[2])

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'http://api.test/api/v1/admin/analytics/export?report=funnel&days=30'
    )
  })

  it.each([
    ['says why the server refused', async () => ({ code: 'FORBIDDEN' })],
    [
      'survives an answer that is not JSON',
      async () => {
        throw new SyntaxError('not JSON')
      }
    ]
  ])('%s, and downloads nothing', async (_name, json) => {
    serve(report())
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    global.fetch = jest.fn(async () => ({ ok: false, json })) as never
    renderPage()
    await screen.findByText('Active today')

    fireEvent.click(screen.getAllByRole('button', { name: 'Download CSV' })[0])

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(click).not.toHaveBeenCalled()
  })
})
