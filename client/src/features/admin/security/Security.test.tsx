import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { ISecurityOverview } from '@lib/utils/admin-security'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import SecurityPage from './SecurityPage'

jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; params?: Record<string, unknown>; body?: Record<string, unknown> }

const overview = (overrides: Partial<ISecurityOverview> = {}): ISecurityOverview => ({
  hours: 24,
  failedLoginsByIp: [
    { key: '1.2.3.4', failures: 9, distinctEmails: 4, lastAt: Date.UTC(2026, 5, 1, 12) },
    { key: '5.6.7.8', failures: 2, distinctEmails: 1, lastAt: Date.UTC(2026, 5, 1, 11) }
  ],
  failedLoginsByEmail: [
    { key: 'victim@example.com', failures: 6, distinctEmails: 1, lastAt: Date.UTC(2026, 5, 1, 12) }
  ],
  sameIpAccounts: [
    {
      ip: '9.9.9.9',
      accounts: [
        { _id: 'u1', name: 'Alice' },
        { _id: 'u2', name: 'Bob' },
        { _id: 'u3', name: 'Carol' }
      ]
    }
  ],
  multiIpAccounts: [{ _id: 'u1', name: 'Alice', ips: 5 }],
  botLockouts: [
    { botId: 'b1', label: 'Fort', ownerId: 'u2', ownerName: 'Bob', failures: 5, lockedUntil: Date.UTC(2026, 5, 2) },
    { botId: 'b2', label: null, ownerId: null, ownerName: null, failures: 5, lockedUntil: Date.UTC(2026, 5, 2) }
  ],
  apiKeys: [
    {
      _id: 'k1',
      name: 'Dash',
      prefix: 'botrts_ab',
      owner: { _id: 'u1', name: 'Alice' },
      scopes: ['read', 'files'],
      ratePerMinute: 60,
      createdAt: 1,
      lastUsedAt: Date.UTC(2026, 5, 1),
      expiresAt: null,
      isRevoked: false,
      rateLimitHits: 3
    },
    {
      _id: 'k2',
      name: 'Old',
      prefix: 'botrts_cd',
      owner: { _id: 'u2', name: 'Bob' },
      scopes: ['read'],
      ratePerMinute: 60,
      createdAt: 1,
      lastUsedAt: null,
      expiresAt: null,
      isRevoked: true,
      rateLimitHits: 0
    }
  ],
  suspiciousScripts: [
    {
      executionId: 'e1',
      owner: { _id: 'u1', name: 'Alice' },
      botId: 'b1',
      file: '/m/loop.js',
      code: 'TIME_LIMIT',
      reason: 'TIME_LIMIT: slow',
      endedAt: Date.UTC(2026, 5, 1)
    }
  ],
  topConsumers: [
    {
      executionId: 'e2',
      userId: 'abcdef12-0000-0000-0000-000000000000',
      botId: 'b9',
      file: '/m/busy.js',
      opsUsed: 4200,
      ticks: 77
    }
  ],
  ...overrides
})

function serve(data: ISecurityOverview, handler: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handler(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/security') return { data }
    return { data: {} }
  }) as never)

  return calls
}

function renderAs(role: IAdminMe['role']) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Provider store={storeWithToken(makeJwt(60))}>
        <AdminMeContext.Provider value={{ role, permissions: [], twoFactor: { isEnrolled: true, isVerified: true } }}>
          <SecurityPage />
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

beforeEach(() => jest.clearAllMocks())

describe('SecurityPage', () => {
  it('shows each list: failures, shared addresses, locked bots, keys, stopped scripts and consumers', async () => {
    serve(overview())
    renderAs('moderator')

    expect(await screen.findByText('1.2.3.4')).toBeInTheDocument()
    expect(screen.getByText('victim@example.com')).toBeInTheDocument()
    expect(screen.getByText('9.9.9.9')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Alice' }).length).toBeGreaterThan(1)
    expect(screen.getByText('5 addresses')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fort' })).toHaveAttribute('href', '/admin/inspector/b1')
    expect(screen.getByText('Dash (botrts_ab…)')).toBeInTheDocument()
    expect(screen.getByText('read, files')).toBeInTheDocument()
    expect(screen.getByText('TIME_LIMIT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '/m/busy.js' })).toHaveAttribute('href', '/admin/inspector/b9')
    expect(screen.getByRole('link', { name: 'abcdef12' })).toHaveAttribute(
      'href',
      '/admin/players/abcdef12-0000-0000-0000-000000000000'
    )
  })

  it('asks for another window of hours', async () => {
    const calls = serve(overview())
    renderAs('moderator')
    await screen.findByText('1.2.3.4')

    fireEvent.click(screen.getByText('72 hours'))

    await waitFor(() => expect(calls.some((call) => call.params?.hours === 72)).toBe(true))
  })

  it('says so when the engine does not answer, and when the page cannot be loaded', async () => {
    serve(overview({ topConsumers: null }))
    const { unmount } = renderAs('moderator')
    expect(await screen.findByText('The engine does not answer')).toBeInTheDocument()
    unmount()

    serve(overview(), (call) =>
      call.url === '/api/v1/admin/security' ? { error: { status: 500, data: {} } } : undefined
    )
    renderAs('moderator')
    expect(await screen.findByText('Could not load the security overview')).toBeInTheDocument()
  })

  it('offers revoking and quarantine to the roles that hold them, and not to a role that lacks them', async () => {
    serve(overview())
    const { unmount } = renderAs('analyst')
    await screen.findByText('1.2.3.4')
    expect(buttonsOf('Revoke')).toHaveLength(0)
    expect(buttonsOf('Quarantine the player')).toHaveLength(0)
    unmount()

    serve(overview())
    renderAs('admin')
    await screen.findByText('1.2.3.4')
    expect(buttonsOf('Revoke')).toHaveLength(1)
    expect(screen.getByText('Revoked')).toBeInTheDocument()
    expect(buttonsOf('Quarantine the player')).toHaveLength(1)
  })

  it('revokes a key with a reason', async () => {
    const calls = serve(overview())
    renderAs('admin')
    fireEvent.click(await button('Revoke'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: 'abusing the API' }
    })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/api-keys/k1/revoke'))).toMatchObject({
        method: 'POST',
        body: { reason: 'abusing the API' }
      })
    )
  })

  it('quarantines the owner of a stopped script, and keeps the dialog when refused', async () => {
    const calls = serve(overview())
    renderAs('admin')
    fireEvent.click(await button('Quarantine the player'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: 'sandbox attacks' }
    })
    fireEvent.click(await button('Confirm'))
    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/supervision/players/u1/quarantine'))?.body).toEqual({
        reason: 'sandbox attacks'
      })
    )
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())

    fireEvent.click(await button('Quarantine the player'))
    fireEvent.click(await button('Cancel'))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })
})
