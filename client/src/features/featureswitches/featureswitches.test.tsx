import { screen, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import ApiKeysCard from '../api-keys/ApiKeysCard'
import SignupForm from '../auth/SignupForm'
import FeatureOffNotice from './FeatureOffNotice'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

function serve(off: Record<string, boolean>) {
  query.mockImplementation((async (args: { url: string }) => {
    if (args.url === '/api/v1/features') return { data: { features: off } }
    if (args.url === '/api/v1/api-keys') return { data: [] }
    return { data: {} }
  }) as never)
}

describe('the notices of switched-off features', () => {
  beforeEach(() => jest.clearAllMocks())

  it('says in words what is off', () => {
    renderApp(<FeatureOffNotice feature="publicApi" />)

    expect(screen.getByText('The public API is switched off for now.')).toBeInTheDocument()
  })

  it('closes the sign-up form while sign-ups are off', async () => {
    serve({ signUps: false })
    renderApp(<SignupForm />)

    expect(await screen.findByText('Sign-ups are closed for now.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign up' })).toBeDisabled())
  })

  it('leaves the sign-up form alone while sign-ups are on, and before the status is known', async () => {
    serve({ signUps: true })
    renderApp(<SignupForm />)

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled()
    await waitFor(() => expect(query).toHaveBeenCalled())
    expect(screen.queryByText('Sign-ups are closed for now.')).not.toBeInTheDocument()
  })

  it('stops the creation of API keys while it is off', async () => {
    serve({ apiKeys: false })
    renderApp(<ApiKeysCard />, { store: storeWithToken(makeJwt(60)) })

    expect(await screen.findByText('Creating API keys is switched off for now.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create a key' })).toBeDisabled())
  })
})
