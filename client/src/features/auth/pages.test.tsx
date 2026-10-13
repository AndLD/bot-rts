import { fireEvent, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { createFakeAuth, renderApp } from '../../../tests/render'
import { errorNotification } from '../../shared/notifications'
import AccountPage from './AccountPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import LinkResultPage from './LinkResultPage'
import ResetPasswordPage from './ResetPasswordPage'
import VerificationPage from './VerificationPage'

const push = jest.fn()
let search = ''

jest.mock('../ambient/AmbientCanvas', () => ({ __esModule: true, default: () => null }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search)
}))
jest.mock('../../shared/notifications', () => ({ errorNotification: jest.fn() }))

const failure = { ok: false as const, failure: { code: 'VALIDATION_FAILED' } }
// Sets the value in one step: typing into the Ant Design forms key by key makes these tests slow
const types = async (placeholder: string, text: string, index = 0) => {
  fireEvent.change(screen.getAllByPlaceholderText(placeholder)[index], { target: { value: text } })
}

beforeEach(() => {
  jest.clearAllMocks()
  search = ''
  localStorage.clear()
})

describe('ForgotPasswordPage', () => {
  it('asks for the reset letter and confirms', async () => {
    const auth = createFakeAuth()
    renderApp(<ForgotPasswordPage />, { auth })

    await types('Email', 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: /reset|send/i }))

    await waitFor(() => expect(auth.requestPasswordReset).toHaveBeenCalledWith('a@b.co'))
    expect(await screen.findByText(/we have sent|If this address/i)).toBeInTheDocument()
  })

  it('shows a failure', async () => {
    renderApp(<ForgotPasswordPage />, {
      auth: createFakeAuth({ requestPasswordReset: jest.fn(() => Promise.resolve(failure)) })
    })

    await types('Email', 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: /reset|send/i }))

    await waitFor(() => expect(errorNotification).toHaveBeenCalled())
  })
})

describe('ResetPasswordPage', () => {
  it('explains that the link is incomplete without a token', () => {
    renderApp(<ResetPasswordPage />)

    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument()
  })

  it('sets the new password with the token of the link', async () => {
    search = 'token=abc'
    const auth = createFakeAuth()
    renderApp(<ResetPasswordPage />, { auth })

    await types('New password', 'New$ecr3t')
    await userEvent.click(screen.getByRole('button', { name: /reset|save|change/i }))

    await waitFor(() => expect(auth.resetPassword).toHaveBeenCalledWith('abc', 'New$ecr3t'))
    expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument()
  })

  it('shows a failure and keeps the form', async () => {
    search = 'token=abc'
    renderApp(<ResetPasswordPage />, {
      auth: createFakeAuth({ resetPassword: jest.fn(() => Promise.resolve(failure)) })
    })

    await types('New password', 'New$ecr3t')
    await userEvent.click(screen.getByRole('button', { name: /reset|save|change/i }))

    await waitFor(() => expect(errorNotification).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument()
  })
})

describe('VerificationPage', () => {
  it('confirms the email and sends an anonymous visitor to the login', async () => {
    search = 'token=abc'
    const auth = createFakeAuth()
    renderApp(<VerificationPage />, { auth })

    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth'))
    expect(auth.verifyEmail).toHaveBeenCalledWith('abc')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('signs a signed-in visitor out first', async () => {
    search = 'token=abc'
    localStorage.setItem('token', 'jwt')
    const auth = createFakeAuth()
    renderApp(<VerificationPage />, { auth })

    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth'))
    expect(auth.signOut).toHaveBeenCalled()
  })
})

describe('LinkResultPage', () => {
  it.each([
    ['confirmEmailChange', /email/i],
    ['confirmAccountDeletion', /account/i]
  ] as const)('%s confirms once and signs the player out', async (action, text) => {
    search = 'token=abc'
    const auth = createFakeAuth()
    renderApp(<LinkResultPage action={action} />, { auth })

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    expect(auth[action]).toHaveBeenCalledTimes(1)
    expect(auth[action]).toHaveBeenCalledWith('abc')
    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
  })

  it('reports a failed confirmation without signing out', async () => {
    search = 'token=abc'
    const auth = createFakeAuth({ confirmEmailChange: jest.fn(() => Promise.resolve(failure)) })
    renderApp(<LinkResultPage action="confirmEmailChange" />, { auth })

    await waitFor(() => expect(screen.getByRole('link', { name: 'Go to login' })).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/could not|failed|expired/i)).toBeInTheDocument())
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('sends the link once even when React runs the effect twice', async () => {
    search = 'token=abc'
    const auth = createFakeAuth()
    renderApp(
      <StrictMode>
        <LinkResultPage action="confirmEmailChange" />
      </StrictMode>,
      { auth }
    )
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())

    expect(auth.confirmEmailChange).toHaveBeenCalledTimes(1)
  })

  it('sends an empty token when the link has none', async () => {
    const auth = createFakeAuth()
    renderApp(<LinkResultPage action="confirmAccountDeletion" />, { auth })

    await waitFor(() => expect(auth.confirmAccountDeletion).toHaveBeenCalledWith(''))
  })
})

describe('AccountPage', () => {
  it('changes the password', async () => {
    const auth = createFakeAuth()
    renderApp(<AccountPage />, { auth })

    await types('Current password', 'Old$ecr3t')
    await types('New password', 'New$ecr3t')
    await userEvent.click(screen.getAllByRole('button')[0])

    await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith('Old$ecr3t', 'New$ecr3t'))
    await waitFor(() => expect(screen.getByPlaceholderText('Current password')).toHaveValue(''))
  })

  it('asks to change the email', async () => {
    const auth = createFakeAuth()
    renderApp(<AccountPage />, { auth })

    await types('Password', 'Pa$$w0rd', 0)
    await types('New email', 'n@b.co')
    await userEvent.click(screen.getAllByRole('button')[1])

    await waitFor(() => expect(auth.requestEmailChange).toHaveBeenCalledWith('Pa$$w0rd', 'n@b.co'))
  })

  it('asks to delete the account', async () => {
    const auth = createFakeAuth()
    renderApp(<AccountPage />, { auth })

    await types('Password', 'Pa$$w0rd', 1)
    await userEvent.click(screen.getAllByRole('button')[2])

    await waitFor(() => expect(auth.requestAccountDeletion).toHaveBeenCalledWith('Pa$$w0rd'))
  })

  it('shows a failure and keeps what was typed', async () => {
    renderApp(<AccountPage />, {
      auth: createFakeAuth({ changePassword: jest.fn(() => Promise.resolve(failure)) })
    })

    await types('Current password', 'Old$ecr3t')
    await types('New password', 'New$ecr3t')
    await userEvent.click(screen.getAllByRole('button')[0])

    await waitFor(() => expect(errorNotification).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('Current password')).toHaveValue('Old$ecr3t')
  })

  it('signs out', async () => {
    const auth = createFakeAuth()
    renderApp(<AccountPage />, { auth })

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(auth.signOut).toHaveBeenCalled()
  })
})
