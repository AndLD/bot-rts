import { fireEvent, screen, waitFor } from '@testing-library/react'
import { notification } from 'antd'
import userEvent from '@testing-library/user-event'
import { createFakeAuth, renderApp } from '../../../tests/render'
import { errorNotification } from '../../shared/notifications'
import AuthPage from './AuthPage'
import BlockedPage from './BlockedPage'
import ForbiddenPage from './ForbiddenPage'
import SigninForm from './SigninForm'
import SignupForm from './SignupForm'

const push = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('../../shared/notifications', () => ({ errorNotification: jest.fn() }))

const failure = { ok: false as const, failure: { code: 'INVALID_CREDENTIALS' } }
// Sets the value in one step: typing into the Ant Design forms key by key makes these tests slow
const types = async (placeholder: string, text: string) => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: text } })
}

describe('SigninForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('signs in with the typed credentials', async () => {
    const auth = createFakeAuth()
    renderApp(<SigninForm />, { auth })

    await types('Email', 'a@b.co')
    await types('Password', 'Pa$$w0rd')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith({ email: 'a@b.co', password: 'Pa$$w0rd' }))
    expect(errorNotification).not.toHaveBeenCalled()
  })

  it('does not submit an empty form and says what is missing', async () => {
    const auth = createFakeAuth()
    renderApp(<SigninForm />, { auth })

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Please enter your email!')).toBeInTheDocument()
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('shows the translated failure', async () => {
    renderApp(<SigninForm />, { auth: createFakeAuth({ signIn: jest.fn(() => Promise.resolve(failure)) }) })

    await types('Email', 'a@b.co')
    await types('Password', 'Pa$$w0rd')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(errorNotification).toHaveBeenCalledWith(expect.any(String), 'Login error'))
  })

  it('links to the password reset', () => {
    renderApp(<SigninForm />)

    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password')
  })
})

describe('SignupForm', () => {
  beforeEach(() => jest.clearAllMocks())

  async function fill() {
    await types('Name', 'Jon')
    await types('Email', 'a@b.co')
    await types('Password', 'Pa$$w0rd')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  }

  it('registers and leads to the page that asks to check the email', async () => {
    const auth = createFakeAuth()
    renderApp(<SignupForm />, { auth })

    await fill()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/forbidden'))
    expect(auth.signUp).toHaveBeenCalledWith({ name: 'Jon', email: 'a@b.co', password: 'Pa$$w0rd' })
  })

  it('rejects a weak password before asking the server', async () => {
    const auth = createFakeAuth()
    renderApp(<SignupForm />, { auth })

    await types('Name', 'Jon')
    await types('Email', 'a@b.co')
    await types('Password', 'weak')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText(/The password must have 6-20 characters/)).toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('shows the failure and stays on the page', async () => {
    renderApp(<SignupForm />, { auth: createFakeAuth({ signUp: jest.fn(() => Promise.resolve(failure)) }) })

    await fill()

    await waitFor(() => expect(errorNotification).toHaveBeenCalledWith(expect.any(String), 'Could not sign up'))
    expect(push).not.toHaveBeenCalled()
  })
})

describe('AuthPage', () => {
  it('switches between login and sign up', async () => {
    renderApp(<AuthPage />)

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()

    await userEvent.click(screen.getByText("Don't have an account? Sign up"))
    expect(screen.getByRole('heading', { name: 'Sign Up' })).toBeInTheDocument()

    await userEvent.click(screen.getByText('Already have an account? Log in'))
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })
})

describe('BlockedPage', () => {
  it('tells the account is blocked', () => {
    renderApp(<BlockedPage />)

    expect(screen.getByText('Your account is blocked')).toBeInTheDocument()
  })
})

describe('ForbiddenPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('asks to check the email and resends the letter', async () => {
    const success = jest.spyOn(notification, 'success').mockImplementation(() => undefined)
    const auth = createFakeAuth()
    renderApp(<ForbiddenPage />, { auth })

    expect(screen.getByText('Check your email. We have sent a verification letter')).toBeInTheDocument()
    await types('Email', 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: 'Send the letter again' }))

    await waitFor(() => expect(auth.resendVerification).toHaveBeenCalledWith('a@b.co'))
    await waitFor(() => expect(success).toHaveBeenCalledWith({ message: expect.stringContaining('new letter') }))
  })

  it('shows a failure to resend', async () => {
    const auth = createFakeAuth({ resendVerification: jest.fn(() => Promise.resolve(failure)) })
    renderApp(<ForbiddenPage />, { auth })

    await types('Email', 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: 'Send the letter again' }))

    await waitFor(() => expect(errorNotification).toHaveBeenCalled())
  })
})
