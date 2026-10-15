import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { IOperationsStatus } from '@lib/utils/admin-operations'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import OperationsPage from './OperationsPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

const status = (overrides: Partial<IOperationsStatus> = {}): IOperationsStatus => ({
  engine: {
    isResponding: true,
    uptimeMs: 125 * 60_000,
    tick: 900,
    lastTickMs: 3,
    p95TickMs: 8,
    executions: 12,
    memoryBytes: 5 * 1024 * 1024
  },
  isPaused: false,
  areScriptsHalted: false,
  jobs: [
    {
      name: 'lifecycle',
      lastRunAt: Date.UTC(2026, 5, 1, 12),
      failures: 2,
      totals: { executionsDeleted: 4, authRowsDeleted: 0 }
    }
  ],
  backup: {
    isConfigured: true,
    finishedAt: Date.now() - 5 * 3_600_000,
    sizeBytes: 3 * 1024 * 1024,
    location: 's3://b/x'
  },
  banner: null,
  ...overrides
})

function serve(data: IOperationsStatus, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/operations' && !args.method) return { data }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <OperationsPage />
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
// The form validates first, so the dialog opens a moment after the click
const confirmWith = async (reason: string) => {
  await waitFor(() => expect(dialog()).not.toBeNull())
  fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: reason } })
  fireEvent.click(await button('Confirm'))
}

beforeEach(() => jest.clearAllMocks())

describe('the engine, the jobs and the backup', () => {
  it('shows how the engine runs, its jobs and the last backup', async () => {
    serve(status())
    renderAs('analyst')

    expect(await screen.findByText('Running')).toBeInTheDocument()
    expect(screen.getByText('2 h 5 min')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
    expect(screen.getByText('5 MB')).toBeInTheDocument()
    expect(screen.getByText('Running normally')).toBeInTheDocument()
    expect(screen.getByText('lifecycle')).toBeInTheDocument()
    expect(screen.getByText('executionsDeleted: 4')).toBeInTheDocument()
    expect(screen.getByText('5 hours')).toBeInTheDocument()
    expect(screen.getByText('3 MB')).toBeInTheDocument()
    expect(screen.getByText('s3://b/x')).toBeInTheDocument()
  })

  it('shows an engine that does not answer, a paused world and switched off scripts', async () => {
    serve(
      status({
        engine: {
          isResponding: false,
          uptimeMs: 0,
          tick: 0,
          lastTickMs: 0,
          p95TickMs: 0,
          executions: 0,
          memoryBytes: 0
        },
        isPaused: true,
        areScriptsHalted: true,
        jobs: []
      })
    )
    renderAs('analyst')

    expect(await screen.findByText('Not responding')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Scripts switched off')).toBeInTheDocument()
    expect(screen.getByText('No job has reported yet')).toBeInTheDocument()
  })

  it('shows a job that did nothing as a dash, and a backup that is not configured or has not reported', async () => {
    serve(
      status({
        jobs: [{ name: 'lifecycle', lastRunAt: null, failures: 0, totals: { executionsDeleted: 0 } }],
        backup: { isConfigured: false, finishedAt: null, sizeBytes: null, location: null }
      })
    )
    const { unmount } = renderAs('analyst')
    expect(await screen.findByText(/BACKUP_STATUS_FILE/)).toBeInTheDocument()
    unmount()

    serve(status({ backup: { isConfigured: true, finishedAt: null, sizeBytes: null, location: null } }))
    renderAs('analyst')
    expect(await screen.findByText('The backup job has not reported yet.')).toBeInTheDocument()
  })

  it('shows a backup without a size', async () => {
    serve(status({ backup: { isConfigured: true, finishedAt: Date.now(), sizeBytes: null, location: null } }))
    renderAs('analyst')

    expect(await screen.findByText('0 hours')).toBeInTheDocument()
  })

  it('says so when the status cannot be loaded', async () => {
    serve(status(), () => ({ error: { status: 500, data: {} } }))
    renderAs('analyst')

    expect(await screen.findByText('Could not load the operations status')).toBeInTheDocument()
  })
})

describe('who may act', () => {
  it('offers nothing to act with to an analyst, the announcement and banner to an admin, and the restart to an owner', async () => {
    serve(status())
    const analyst = renderAs('analyst')
    await screen.findByText('Running')
    expect(buttonsOf('Send to all players')).toHaveLength(0)
    expect(buttonsOf('Restart all scripts')).toHaveLength(0)
    analyst.unmount()

    serve(status())
    const admin = renderAs('admin')
    await screen.findByText('Running')
    expect(buttonsOf('Send to all players')).toHaveLength(1)
    expect(buttonsOf('Restart all scripts')).toHaveLength(0)
    admin.unmount()

    serve(status())
    renderAs('owner')
    await screen.findByText('Running')
    expect(buttonsOf('Restart all scripts')).toHaveLength(1)
  })
})

describe('announcements and the banner', () => {
  it('sends an announcement with a reason and says how many players were told', async () => {
    const calls = serve(status(), (call) =>
      call.url.endsWith('/announcements') ? { data: { recipients: 7 } } : undefined
    )
    renderAs('admin')
    await screen.findByText('Running')

    fireEvent.change(screen.getByLabelText('What every player is told'), { target: { value: 'Update at noon' } })
    fireEvent.click(await button('Send to all players'))
    await confirmWith('planned update')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/announcements'))?.body).toEqual({
        text: 'Update at noon',
        reason: 'planned update'
      })
    )
    expect(await screen.findByText('7 players were told')).toBeInTheDocument()
    expect(await screen.findByText('7 players were told')).toBeInTheDocument()

    fireEvent.click(document.querySelector('.ant-alert-close-icon') as Element)
    await waitFor(() => expect(screen.queryByText('7 players were told')).not.toBeInTheDocument())
  })

  it('shows the banner with its times, sets it, and removes it', async () => {
    const calls = serve(
      status({ banner: { message: 'Down for an hour', startsAt: Date.UTC(2026, 5, 1, 12), endsAt: null } })
    )
    renderAs('admin')
    expect(await screen.findByText('Down for an hour')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Back soon' } })
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-06-02T10:00' } })
    fireEvent.change(screen.getByLabelText('Expected to end (optional)'), { target: { value: '2026-06-02T11:00' } })
    fireEvent.click(await button('Show the banner'))
    await confirmWith('planned update')
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
        message: 'Back soon',
        startsAt: new Date('2026-06-02T10:00').getTime(),
        endsAt: new Date('2026-06-02T11:00').getTime(),
        reason: 'planned update'
      })
    )
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    fireEvent.click(await button('Remove'))
    await confirmWith('done')
    await waitFor(() => expect(calls.find((call) => call.method === 'DELETE')?.body).toEqual({ reason: 'done' }))
  })

  it('sets a banner without an end', async () => {
    const calls = serve(status())
    renderAs('admin')
    await screen.findByText('Running')

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Back soon' } })
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-06-02T10:00' } })
    fireEvent.click(await button('Show the banner'))
    await confirmWith('planned update')

    await waitFor(() => expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ endsAt: null }))
  })

  it('keeps the dialog and tells why when the server refuses', async () => {
    serve(status(), (call) =>
      call.url.endsWith('/announcements') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined
    )
    renderAs('admin')
    await screen.findByText('Running')
    fireEvent.change(screen.getByLabelText('What every player is told'), { target: { value: 'Hello' } })
    fireEvent.click(await button('Send to all players'))
    await confirmWith('because')

    await waitFor(() => expect(buttonsOf('Confirm')).toHaveLength(1))
    expect(dialog()).toBeInTheDocument()
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })
})

describe('restarting the scripts', () => {
  it('restarts with a reason and says how many scripts and bots', async () => {
    const calls = serve(status(), (call) =>
      call.url.endsWith('/restart-runtime') ? { data: { restarted: 3, failedBots: 1 } } : undefined
    )
    renderAs('owner')
    await screen.findByText('Running')

    fireEvent.click(await button('Restart all scripts'))
    expect(await screen.findByText(/stopped and started again/)).toBeInTheDocument()
    await confirmWith('the runtime is stuck')

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/restart-runtime'))?.body).toEqual({
        reason: 'the runtime is stuck'
      })
    )
    expect(await screen.findByText('3 scripts restarted, 1 bot could not be restarted')).toBeInTheDocument()
  })
})
