import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import AdminKeysPage from './AdminKeysPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; body?: Record<string, unknown> }

const NOW = Date.UTC(2026, 9, 16)
const key = (overrides: Record<string, unknown> = {}) => ({
  _id: 'k1',
  name: 'Assistant',
  prefix: 'botrts_ab12',
  scopes: ['admin:logs:read', 'admin:audit:read'],
  ratePerMinute: 60,
  ownerId: 'u1',
  reason: 'investigating',
  ipAllowList: [] as string[],
  createdAt: 1,
  lastUsedAt: null as number | null,
  expiresAt: Date.now() + 86_400_000,
  revokedAt: null as number | null,
  ...overrides
})

function serve(keys: unknown[], handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/api-keys' && !args.method) return { data: keys }
    return { data: {} }
  }) as never)

  return calls
}

const renderPage = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminKeysPage />
      </Provider>
    </NextIntlClientProvider>
  )

const buttonsOf = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttonsOf(label).length).toBeGreaterThan(0)).then(() => buttonsOf(label)[0])
const dialog = () => document.querySelector('.ant-modal') as HTMLElement

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
})
afterEach(() => jest.restoreAllMocks())

describe('AdminKeysPage', () => {
  it('lists the keys with their scopes, reason, addresses and state', async () => {
    serve([
      key({ ipAllowList: ['10.0.0.1'], lastUsedAt: NOW }),
      key({ _id: 'k2', name: 'Old', revokedAt: 5 }),
      key({ _id: 'k3', name: 'Lapsed', expiresAt: NOW - 1000 })
    ])
    renderPage()

    expect(await screen.findByText('Assistant')).toBeInTheDocument()
    expect(screen.getAllByText('admin:logs:read').length).toBeGreaterThan(0)
    expect(screen.getAllByText('investigating').length).toBeGreaterThan(0)
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Revoked')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    // Only a key that still works can be revoked
    expect(buttonsOf('Revoke')).toHaveLength(2)
  })

  it('says so when the keys cannot be loaded', async () => {
    serve([], (call) => (call.url.endsWith('/admin/api-keys') ? { error: { status: 500, data: {} } } : undefined))
    renderPage()

    expect(await screen.findByText('Could not load the admin API keys')).toBeInTheDocument()
  })

  it('creates a key with scopes, days, addresses and a reason, and shows its secret once', async () => {
    const calls = serve([], (call) =>
      call.method === 'POST' ? { data: { ...key(), secret: 'botrts_the_secret' } } : undefined
    )
    renderPage()
    fireEvent.click(await button('Create a key'))
    fireEvent.change(dialog().querySelector('input[id$="name"]') as HTMLInputElement, { target: { value: 'My key' } })
    fireEvent.click(screen.getByLabelText(/admin:audit:read/))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'weekly check' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toMatchObject({
        url: '/api/v1/admin/api-keys',
        body: {
          name: 'My key',
          scopes: ['admin:audit:read'],
          reason: 'weekly check',
          expiresInDays: 7,
          ipAllowList: []
        }
      })
    )
    expect(await screen.findByTestId('admin-key-secret')).toHaveTextContent('botrts_the_secret')
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })

  it('keeps the dialog and shows the reason when the server refuses the key', async () => {
    serve([], (call) =>
      call.method === 'POST' ? { error: { status: 400, data: { code: 'VALIDATION_FAILED', error: 'no' } } } : undefined
    )
    renderPage()
    fireEvent.click(await button('Create a key'))
    fireEvent.change(dialog().querySelector('input[id$="name"]') as HTMLInputElement, { target: { value: 'k' } })
    fireEvent.click(screen.getByLabelText(/admin:logs:read/))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'because' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() => expect(screen.queryByTestId('admin-key-secret')).toBeNull())
    expect(dialog()).toBeInTheDocument()
  })

  it('revokes a key with a reason, and does nothing when the dialog is cancelled', async () => {
    const calls = serve([key()])
    renderPage()
    fireEvent.click(await button('Revoke'))
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    fireEvent.click(await button('Revoke'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'not needed' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/api-keys/k1/revoke'))).toMatchObject({
        method: 'POST',
        body: { reason: 'not needed' }
      })
    )
  })
})
