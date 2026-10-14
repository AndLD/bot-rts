import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import { NextIntlClientProvider } from 'next-intl'
import { Provider } from 'react-redux'
import type { IAdminMe } from '@lib/utils/admin'
import type { IPlayerListItem, IPlayerProfile } from '@lib/utils/admin-players'
import messages from '../../../../messages/en.json'
import { makeJwt } from '../../../../tests/jwt'
import { storeWithToken } from '../../../../tests/render'
import { baseQueryWithRefresh } from '../../../shared/store/baseQuery'
import { AdminMeContext } from '../admin-me-context'
import PlayerProfilePage from './PlayerProfilePage'
import PlayersPage from './PlayersPage'

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'p1' }) }))
jest.mock('../../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

type Call = { url: string; method?: string; params?: Record<string, unknown>; body?: Record<string, unknown> }

const item = (overrides: Partial<IPlayerListItem> = {}): IPlayerListItem => ({
  _id: 'p1',
  name: 'Alice',
  email: 'alice@example.com',
  status: 'user',
  isEmailVerified: true,
  createdAt: Date.UTC(2026, 4, 1),
  lastLoginAt: null,
  ...overrides
})

const profile = (overrides: Partial<IPlayerProfile> = {}): IPlayerProfile => ({
  ...item(),
  isDeleted: false,
  sessions: [{ _id: 's1', userAgent: 'Firefox', createdAt: 1, lastUsedAt: 2, expiresAt: 3, isActive: true }],
  bases: [{ _id: 'b1', label: 'Home', botCount: 3 }],
  botCount: 3,
  resources: [{ resource: 'iron', amount: 9 }],
  runningExecutions: 2,
  activeBan: null,
  bans: [],
  notes: [{ _id: 'n1', authorId: 'a', text: 'friendly', createdAt: 5 }],
  timeline: [
    { at: 10, kind: 'login', detail: 'Firefox' },
    { at: 1, kind: 'registered', detail: null }
  ],
  ...overrides
})

function serve(handlers: (call: Call) => unknown = () => undefined, data: { profile?: IPlayerProfile } = {}) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = handlers(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/players') {
      return {
        data: {
          result: [item(), item({ _id: 'p2', name: 'Bob', status: 'banned' })],
          meta: { pagination: { page: 1, results: 20, total: 45 } }
        }
      }
    }
    if (args.url === '/api/v1/admin/players/p1' && !args.method) return { data: data.profile ?? profile() }
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

// Role queries are slow on the large DOM of an Ant Design modal, so buttons are found by their text
const buttonsOf = (label: string) =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label)
const button = (label: string) =>
  waitFor(() => expect(buttonsOf(label).length).toBeGreaterThan(0)).then(() => buttonsOf(label)[0])
const dialog = () => document.querySelector('.ant-modal') as HTMLElement

describe('PlayersPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('lists the players with their status and a link to the profile', async () => {
    serve()
    renderAs('moderator', <PlayersPage />)

    const link = await screen.findByRole('link', { name: 'Alice' })
    expect(link).toHaveAttribute('href', '/admin/players/p1')
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getAllByText('Banned').length).toBeGreaterThan(0)
  })

  it('toggles the sort, keeps it when the sort is cleared, and filters by banned', async () => {
    const calls = serve()
    renderAs('moderator', <PlayersPage />)
    await screen.findByText('Alice')
    const header = () => screen.getByText('Name', { selector: '.ant-table-column-title' })

    fireEvent.click(header())
    await waitFor(() =>
      expect(calls.some((call) => call.params?.sort === 'name' && call.params?.order === 'asc')).toBe(true)
    )
    fireEvent.click(header())
    await waitFor(() =>
      expect(calls.some((call) => call.params?.sort === 'name' && call.params?.order === 'desc')).toBe(true)
    )
    const before = calls.length
    fireEvent.click(header())
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(before))
    expect(calls[calls.length - 1].params?.sort).toBe('name')

    const [statusSelect] = Array.from(document.querySelectorAll('.ant-select-selector'))
    fireEvent.mouseDown(statusSelect)
    fireEvent.click(await screen.findByText('Banned', { selector: '.ant-select-item-option-content' }))
    await waitFor(() => expect(calls[calls.length - 1].params?.status).toBe('banned'))
  })

  it('searches, filters, sorts and pages on the server', async () => {
    const calls = serve()
    renderAs('moderator', <PlayersPage />)
    await screen.findByText('Alice')

    fireEvent.change(screen.getByPlaceholderText('Search by name, email or id'), { target: { value: 'ali' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Search by name, email or id'), { key: 'Enter', keyCode: 13 })
    await waitFor(() => expect(calls.some((call) => call.params?.q === 'ali')).toBe(true))

    fireEvent.click(screen.getByText('Email', { selector: '.ant-table-column-title' }))
    await waitFor(() =>
      expect(calls.some((call) => call.params?.sort === 'email' && call.params?.order === 'asc')).toBe(true)
    )

    fireEvent.click(await screen.findByTitle('2'))
    await waitFor(() => expect(calls.some((call) => call.params?.page === 2)).toBe(true))
  })

  it('filters by status and by verification', async () => {
    const calls = serve()
    renderAs('moderator', <PlayersPage />)
    await screen.findByText('Alice')

    const [statusSelect, verifiedSelect] = Array.from(document.querySelectorAll('.ant-select-selector'))
    fireEvent.mouseDown(statusSelect)
    fireEvent.click(await screen.findByText('Moderator', { selector: '.ant-select-item-option-content' }))
    await waitFor(() => expect(calls.some((call) => call.params?.status === 'moderator')).toBe(true))

    fireEvent.mouseDown(verifiedSelect)
    fireEvent.click(await screen.findByText('Not verified', { selector: '.ant-select-item-option-content' }))
    await waitFor(() => expect(calls.some((call) => call.params?.isEmailVerified === false)).toBe(true))
  })

  it('says so when the list cannot be loaded', async () => {
    serve((call) => (call.url === '/api/v1/admin/players' ? { error: { status: 500, data: {} } } : undefined))
    renderAs('moderator', <PlayersPage />)

    expect(await screen.findByText('Could not load the players')).toBeInTheDocument()
  })
})

describe('PlayerProfilePage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the account, what the player owns and what happened', async () => {
    serve()
    renderAs('moderator', <PlayerProfilePage />)

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('iron: 9')).toBeInTheDocument()
    expect(screen.getByText('Home · 3 bots')).toBeInTheDocument()
    expect(screen.getAllByText('Firefox').length).toBeGreaterThan(0)
    expect(screen.getByText('friendly')).toBeInTheDocument()
    expect(screen.getByText(/· Registered$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← All players' })).toHaveAttribute('href', '/admin/players')
  })

  it('shows an active ban with its reason and end, and a deleted account', async () => {
    serve(undefined, {
      profile: profile({
        status: 'banned',
        activeBan: {
          _id: 'x',
          reason: 'spamming',
          bannedBy: 'a',
          createdAt: 1,
          expiresAt: null,
          liftedAt: null,
          liftedBy: null
        },
        isDeleted: true
      })
    })
    renderAs('moderator', <PlayerProfilePage />)

    expect(await screen.findByText('Banned until an admin lifts the ban')).toBeInTheDocument()
    expect(screen.getByText('spamming')).toBeInTheDocument()
    expect(screen.getByText('This account was deleted; its personal data is erased.')).toBeInTheDocument()
    // a deleted account has no actions
    expect(screen.queryByRole('button', { name: 'Unban' })).toBeNull()
  })

  it('shows the end of a timed ban', async () => {
    serve(undefined, {
      profile: profile({
        status: 'banned',
        activeBan: {
          _id: 'x',
          reason: 'r',
          bannedBy: 'a',
          createdAt: 1,
          expiresAt: Date.UTC(2026, 5, 1),
          liftedAt: null,
          liftedBy: null
        }
      })
    })
    renderAs('moderator', <PlayerProfilePage />)

    expect(await screen.findByText(/Banned until Jun 1, 2026/)).toBeInTheDocument()
  })

  it('adds a note, and offers none to a role without the permission', async () => {
    const calls = serve()
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.change(await screen.findByPlaceholderText('A note for other admins'), { target: { value: 'be nice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/notes'))).toMatchObject({
        method: 'POST',
        body: { text: 'be nice' }
      })
    )
  })

  it('does not offer notes to an analyst', async () => {
    serve()
    renderAs('analyst', <PlayerProfilePage />)
    await screen.findByText('alice@example.com')

    expect(screen.queryByPlaceholderText('A note for other admins')).toBeNull()
  })

  it('reports a failed note and a profile that cannot be loaded', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve((call) => (call.url.endsWith('/notes') ? { error: { status: 404, data: { code: 'NOT_FOUND' } } } : undefined))
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.change(await screen.findByPlaceholderText('A note for other admins'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not found' })))

    serve((call) => (call.url === '/api/v1/admin/players/p1' ? { error: { status: 404, data: {} } } : undefined))
    renderAs('moderator', <PlayerProfilePage />)
    expect(await screen.findByText('Could not load the players')).toBeInTheDocument()
  })
})

describe('PlayerProfilePage with little to show', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows dashes and unnamed bases, and waits while loading', async () => {
    serve(undefined, {
      profile: profile({
        bases: [{ _id: 'b-unnamed', label: null, botCount: 0 }],
        resources: [],
        sessions: [{ _id: 's1', userAgent: null, createdAt: 1, lastUsedAt: 2, expiresAt: 3, isActive: false }],
        notes: [],
        isEmailVerified: false,
        lastLoginAt: 5
      })
    })
    const { container } = renderAs('moderator', <PlayerProfilePage />)
    expect(container.querySelector('.ant-spin')).not.toBeNull()

    expect(await screen.findByText('b-unnamed · 0 bots')).toBeInTheDocument()
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.getAllByText('–').length).toBeGreaterThan(1)
  })
})

describe('the actions of a player', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows a moderator the moderation actions, and not the owner-only ones', async () => {
    serve()
    renderAs('moderator', <PlayerProfilePage />)
    await screen.findByText('alice@example.com')

    for (const label of ['Ban', 'Sign out everywhere', 'Resend verification', 'Send password reset']) {
      expect(buttonsOf(label).length).toBe(1)
    }
    for (const label of ['Unban', 'Change role', 'Delete account']) {
      expect(buttonsOf(label).length).toBe(0)
    }
  })

  it('shows an owner everything, with Unban in place of Ban for a banned player', async () => {
    serve(undefined, { profile: profile({ status: 'banned' }) })
    renderAs('owner', <PlayerProfilePage />)
    await screen.findByText('alice@example.com')

    expect(buttonsOf('Unban').length).toBe(1)
    expect(buttonsOf('Ban').length).toBe(0)
    expect(buttonsOf('Change role').length).toBe(1)
    expect(buttonsOf('Delete account').length).toBe(1)
  })

  it('asks for a reason, then bans for the chosen time', async () => {
    const calls = serve()
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.click(await button('Ban'))

    fireEvent.click(await button('Confirm'))
    expect(await screen.findByText('Say why, in at least 3 characters')).toBeInTheDocument()
    expect(calls.some((call) => call.url.endsWith('/ban'))).toBe(false)

    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'spamming chat' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith('/ban'))).toMatchObject({
        method: 'POST',
        body: { reason: 'spamming chat', durationHours: 24 }
      })
    )
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })

  it('bans until lifted when the duration is left open', async () => {
    const calls = serve()
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.click(await button('Ban'))
    fireEvent.mouseDown(dialog().querySelector('.ant-select-selector') as Element)
    fireEvent.click(await screen.findByText('Until lifted', { selector: '.ant-select-item-option-content' }))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'cheating' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() => expect(calls.find((call) => call.url.endsWith('/ban'))?.body).toEqual({ reason: 'cheating' }))
  })

  it.each([
    ['Sign out everywhere', '/logout'],
    ['Resend verification', '/resend-verification'],
    ['Send password reset', '/reset-password']
  ])('sends %s with the reason', async (label, path) => {
    const calls = serve()
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.click(await button(label))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'because' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith(path))).toMatchObject({
        method: 'POST',
        body: { reason: 'because' }
      })
    )
  })

  it('unbans, changes a role and deletes an account with the typed email', async () => {
    const calls = serve(undefined, { profile: profile({ status: 'banned' }) })
    const { unmount } = renderAs('owner', <PlayerProfilePage />)
    fireEvent.click(await button('Unban'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'appealed' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() => expect(calls.find((call) => call.url.endsWith('/unban'))?.body).toEqual({ reason: 'appealed' }))
    unmount()

    serve()
    const second = renderAs('owner', <PlayerProfilePage />)
    fireEvent.click(await button('Change role'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'trusted' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() => expect(query.mock.calls.some(([args]) => (args as Call).url.endsWith('/role'))).toBe(true))
    expect(query.mock.calls.map(([args]) => args as Call).find((args) => args.url.endsWith('/role'))).toMatchObject({
      method: 'PUT',
      body: { reason: 'trusted', role: 'user' }
    })
    second.unmount()

    serve()
    renderAs('owner', <PlayerProfilePage />)
    fireEvent.click(await button('Delete account'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'requested' } })
    fireEvent.change(dialog().querySelector('input') as HTMLInputElement, { target: { value: 'alice@example.com' } })
    fireEvent.click(await button('Confirm'))
    await waitFor(() =>
      expect(query.mock.calls.map(([args]) => args as Call).find((args) => args.method === 'DELETE')).toMatchObject({
        body: { reason: 'requested', confirmEmail: 'alice@example.com' }
      })
    )
  })

  it('keeps the dialog open and tells why when the server refuses', async () => {
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    serve((call) => (call.url.endsWith('/ban') ? { error: { status: 403, data: { code: 'FORBIDDEN' } } } : undefined))
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.click(await button('Ban'))
    fireEvent.change(dialog().querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'because' } })
    fireEvent.click(await button('Confirm'))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'You are not allowed to do this' }))
    )
    expect(dialog()).toBeInTheDocument()
  })

  it('lets the dialog be cancelled', async () => {
    serve()
    renderAs('moderator', <PlayerProfilePage />)
    fireEvent.click(await button('Ban'))
    fireEvent.click(await button('Cancel'))

    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeNull())
  })
})
