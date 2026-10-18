import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import { IRetention, RETENTION_JOBS } from '@lib/utils/admin-retention'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import RetentionCard from './RetentionCard'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

const DEFAULTS: Record<string, Record<string, number | boolean>> = {
  lifecycle: { isEnabled: true, intervalMinutes: 60 },
  terminalLogs: { isEnabled: true, logDays: 30, securityDays: 90, maxLinesPerBot: 5000 },
  executions: { isEnabled: true, days: 30 },
  notifications: { isEnabled: true, days: 30 },
  authData: { isEnabled: true, days: 7 },
  unverifiedAccounts: { isEnabled: true, days: 7 },
  inactiveAccounts: { isEnabled: false, inactiveDays: 365, noticeDays: 30 },
  playerActivity: { isEnabled: true, days: 400 },
  monitoring: { fineDays: 7, coarseDays: 30 },
  logs: { days: 14 }
}

const retention = (overrides: Partial<IRetention> = {}): IRetention => ({
  jobs: RETENTION_JOBS.map((job) => ({
    job,
    values: DEFAULTS[job],
    defaults: DEFAULTS[job],
    isOverridden: job === 'authData',
    lastRemoved: job === 'executions' ? 4 : null
  })),
  lastRunAt: Date.UTC(2026, 5, 1, 12),
  hasFailures: false,
  updatedAt: null,
  ...overrides
})

function serve(data: IRetention, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/retention' && !args.method) return { data }
    return { data }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <RetentionCard />
        </AdminMeContext.Provider>
      </Provider>
    </NextIntlClientProvider>
  )
}

const buttonsOf = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttonsOf(label).length).toBeGreaterThan(0)).then(() => buttonsOf(label)[0])
const dialog = () => document.querySelector('.ant-modal') as HTMLElement
const reasonField = () => dialog().querySelector('textarea') as HTMLTextAreaElement
const toggle = async (name: string) => {
  const control = await screen.findByRole('switch', { name })
  await waitFor(() => expect(control).toBeEnabled())
  fireEvent.click(control)
}

beforeEach(() => jest.clearAllMocks())

describe('the retention card', () => {
  it('shows every job with its values, the last pass and what was changed', async () => {
    serve(retention())
    renderAs('admin')

    expect(await screen.findByText('Finished script executions')).toBeInTheDocument()
    expect(screen.getByText('Monitoring history (in memory)')).toBeInTheDocument()
    expect(screen.getByText('Logs and traces in the log store')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(screen.getByText(/Last cleanup pass: 6\/1\/26/)).toBeInTheDocument()
    expect(screen.queryByText('A step of the last cleanup pass failed; see the logs.')).not.toBeInTheDocument()
  })

  it('warns of a failed step, and says so when it cannot be loaded', async () => {
    serve(retention({ hasFailures: true, lastRunAt: null }))
    renderAs('admin')
    expect(await screen.findByText('A step of the last cleanup pass failed; see the logs.')).toBeInTheDocument()
    expect(screen.getByText('Last cleanup pass: –')).toBeInTheDocument()
  })

  it('says so when it cannot be loaded', async () => {
    serve(retention(), () => ({ error: { status: 500, data: {} } }))
    renderAs('admin')

    expect(await screen.findByText('Could not load the retention settings')).toBeInTheDocument()
  })

  it('stages a switch and a range, and saves only what changed with a reason', async () => {
    const calls = serve(retention())
    renderAs('admin')
    await toggle('Notifications')
    const days = (await screen.findByLabelText('Finished script executions: keep')) as HTMLInputElement
    fireEvent.change(days, { target: { value: '10' } })

    fireEvent.click(await button('Save changes'))
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.change(reasonField(), { target: { value: 'less to keep' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
        jobs: { notifications: { isEnabled: false }, executions: { days: 10 } },
        reason: 'less to keep'
      })
    )
  })

  it('asks for the typed word when the erasure of accounts is switched on', async () => {
    const calls = serve(retention())
    renderAs('owner')
    await toggle('Erasure of inactive accounts')
    fireEvent.click(await button('Save changes'))
    await waitFor(() => expect(dialog()).not.toBeNull())

    fireEvent.change(reasonField(), { target: { value: 'policy' } })
    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'ERASE' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
        jobs: { inactiveAccounts: { isEnabled: true } },
        reason: 'policy',
        confirmation: 'ERASE'
      })
    )
  })

  it('ignores a range that is cleared, and does not stage it', async () => {
    serve(retention())
    renderAs('admin')
    const days = (await screen.findByLabelText('Finished script executions: keep')) as HTMLInputElement

    fireEvent.change(days, { target: { value: '' } })

    expect(buttonsOf('Save changes')[0]).toBeDisabled()
  })

  it('discards the staged changes', async () => {
    serve(retention())
    renderAs('admin')
    await toggle('Notifications')

    fireEvent.click(await button('Discard'))

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Notifications' })).toBeChecked())
    expect(buttonsOf('Save changes')[0]).toBeDisabled()
  })

  it('puts everything back with one button, with a reason', async () => {
    const calls = serve(retention())
    renderAs('admin')
    fireEvent.click(await button('Reset all to the defaults'))
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.change(reasonField(), { target: { value: 'back to normal' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url === '/api/v1/admin/retention/reset')?.body).toEqual({
        reason: 'back to normal'
      })
    )
  })

  it('closes the dialog on cancel without sending anything', async () => {
    const calls = serve(retention())
    renderAs('admin')
    fireEvent.click(await button('Reset all to the defaults'))
    await waitFor(() => expect(dialog()).not.toBeNull())

    fireEvent.click(await button('Cancel'))

    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('keeps the dialog when the server refuses', async () => {
    const calls = serve(retention(), (call) =>
      call.method === 'POST' ? { error: { status: 400, data: {} } } : undefined
    )
    renderAs('admin')
    fireEvent.click(await button('Reset all to the defaults'))
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.change(reasonField(), { target: { value: 'back to normal' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(dialog()).not.toBeNull()
  })

  it('only reads for a role without ops.retention', async () => {
    serve(retention())
    renderAs('moderator')

    expect(await screen.findByRole('switch', { name: 'Notifications' })).toBeDisabled()
    expect(buttonsOf('Save changes')).toHaveLength(0)
    expect(buttonsOf('Reset all to the defaults')).toHaveLength(0)
  })
})
