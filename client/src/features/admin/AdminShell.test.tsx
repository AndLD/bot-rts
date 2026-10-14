import { notification } from 'antd'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { createFakeAuth, renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import AdminHome from './AdminHome'
import { useAdminMe } from './admin-me-context'
import AdminShell from './AdminShell'

const replace = jest.fn()
const NAV = [
  { path: '/admin', labelKey: 'home' },
  { path: '/admin/players', labelKey: 'home', permission: 'players.read' },
  { path: '/admin/ops', labelKey: 'home', permission: 'ops.pause-world' }
] as const
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/admin' }))
jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)
const opts = () => ({ store: storeWithToken(makeJwt(60)) })

const me = (overrides: Record<string, unknown> = {}) => ({
  role: 'moderator',
  permissions: ['players.read', 'players.ban'],
  twoFactor: { isEnrolled: true, isVerified: true },
  ...overrides
})

type Call = { url: string; method?: string; body?: unknown }

// Answers the admin routes from a mutable state, like the server would
function serve(state: { me: unknown | 'forbidden' | 'broken' }, onCall: (call: Call) => unknown = () => undefined) {
  const calls: Call[] = []
  query.mockImplementation((async (args: Call) => {
    calls.push(args)
    const custom = onCall(args)
    if (custom) return custom
    if (args.url === '/api/v1/admin/me') {
      if (state.me === 'forbidden') return { error: { status: 403, data: { code: 'FORBIDDEN' } } }
      if (state.me === 'broken') return { error: { status: 500, data: {} } }
      return { data: state.me }
    }
    return { data: {} }
  }) as never)

  return calls
}

describe('AdminShell', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sends a signed-in player who is not an admin back to the game', async () => {
    serve({ me: 'forbidden' })
    renderApp(<AdminShell>secret</AdminShell>, opts())

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/game'))
    expect(screen.queryByText('secret')).toBeNull()
  })

  it('says so when the console cannot be loaded', async () => {
    serve({ me: 'broken' })
    renderApp(<AdminShell>secret</AdminShell>, opts())

    expect(await screen.findByText('Could not load the console')).toBeInTheDocument()
  })

  it('shows the pages with the role of the admin once the second factor is verified', async () => {
    serve({ me: me() })
    renderApp(
      <AdminShell nav={NAV}>
        <AdminHome />
      </AdminShell>,
      opts()
    )

    expect(await screen.findByText('Welcome to the admin console')).toBeInTheDocument()
    expect(screen.getAllByText('Moderator').length).toBeGreaterThan(0)
    expect(screen.getByText('players.read, players.ban')).toBeInTheDocument()
    // The menu shows the pages the role has the permission for, and no others
    expect(screen.getAllByRole('link', { name: 'Overview' }).map((link) => link.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/players'
    ])
  })

  it('signs the admin out', async () => {
    serve({ me: me() })
    const auth = createFakeAuth()
    renderApp(<AdminShell>x</AdminShell>, { ...opts(), auth })

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth'))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('asks for a code when the factor is set up but the session is not verified, and shows an error for a bad code', async () => {
    const state = { me: me({ twoFactor: { isEnrolled: true, isVerified: false } }) }
    const calls = serve(state, (call) =>
      call.url === '/api/v1/admin/2fa/verify'
        ? { error: { status: 403, data: { code: 'TWO_FACTOR_INVALID' } } }
        : undefined
    )
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    renderApp(<AdminShell>secret</AdminShell>, opts())

    fireEvent.change(await screen.findByPlaceholderText('Code or recovery code'), { target: { value: ' 123456 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() =>
      expect(calls.find((call) => call.url === '/api/v1/admin/2fa/verify')?.body).toEqual({ code: '123456' })
    )
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'The code is not valid or was already used' })
      )
    )
    expect(screen.queryByText('secret')).toBeNull()
  })

  it('lets the admin in after a good code', async () => {
    const state = { me: me({ twoFactor: { isEnrolled: true, isVerified: false } }) }
    serve(state, (call) => {
      if (call.url === '/api/v1/admin/2fa/verify') {
        state.me = me()
        return { data: {} }
      }
    })
    renderApp(<AdminShell>secret</AdminShell>, opts())

    fireEvent.change(await screen.findByPlaceholderText('Code or recovery code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('secret')).toBeInTheDocument()
  })

  it('walks an admin through the enrollment: secret, first code, recovery codes, then the console', async () => {
    const state = { me: me({ twoFactor: { isEnrolled: false, isVerified: false } }) }
    const calls = serve(state, (call) => {
      if (call.url === '/api/v1/admin/2fa/enroll') {
        return { data: { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP' } }
      }
      if (call.url === '/api/v1/admin/2fa/confirm') {
        state.me = me()
        return { data: { recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'] } }
      }
    })
    renderApp(<AdminShell>secret</AdminShell>, opts())

    fireEvent.click(await screen.findByRole('button', { name: 'Set up' }))
    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('aaaaa-bbbbb')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/api/v1/admin/2fa/confirm')?.body).toEqual({ code: '123456' })
    fireEvent.click(screen.getByRole('button', { name: 'I have saved them' }))

    expect(await screen.findByText('secret')).toBeInTheDocument()
  })

  it('reports a failed enrollment and a failed confirmation', async () => {
    const state = { me: me({ twoFactor: { isEnrolled: false, isVerified: false } }) }
    let enrollFails = true
    serve(state, (call) => {
      if (call.url === '/api/v1/admin/2fa/enroll') {
        return enrollFails
          ? { error: { status: 400, data: { code: 'VALIDATION_FAILED' } } }
          : { data: { secret: 'S', otpauthUrl: 'otpauth://totp/x?secret=S' } }
      }
      if (call.url === '/api/v1/admin/2fa/confirm') {
        return { error: { status: 403, data: { code: 'TWO_FACTOR_INVALID' } } }
      }
    })
    const error = jest.spyOn(notification, 'error').mockImplementation(() => undefined)
    renderApp(<AdminShell>secret</AdminShell>, opts())

    fireEvent.click(await screen.findByRole('button', { name: 'Set up' }))
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ description: 'Please check the entered data' }))
    )

    enrollFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
    fireEvent.change(await screen.findByPlaceholderText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'The code is not valid or was already used' })
      )
    )
  })
})

describe('useAdminMe', () => {
  it('refuses to be used outside the shell', () => {
    const Probe = () => {
      useAdminMe()
      return null
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderApp(<Probe />)).toThrow('inside the admin shell')
    spy.mockRestore()
  })
})
