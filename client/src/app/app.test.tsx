import { render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { makeJwt } from '../../tests/jwt'
import { baseQueryWithRefresh } from '../shared/store/baseQuery'
import messages from '../../messages/en.json'
import { Providers } from './Providers'

const replace = jest.fn()
let pathname = '/game'

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => pathname }))
jest.mock('../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

function renderProviders(children = <p>content</p>) {
  return render(
    <NextIntlWrapper>
      <Providers>{children}</Providers>
    </NextIntlWrapper>
  )
}

// Providers brings its own store and auth client, so only the texts are wrapped
function NextIntlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}

describe('Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    pathname = '/game'
  })

  it('sends an anonymous visitor to the login and renders nothing meanwhile', async () => {
    const { container } = renderProviders()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth'))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the page of a visitor who may see it', async () => {
    pathname = '/auth'
    renderProviders()

    expect(await screen.findByText('content')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('renders nothing while the visitor is being identified, then the page', async () => {
    localStorage.setItem('token', makeJwt(60))
    query.mockResolvedValue({ data: { _id: 'u1', name: 'Jon' } })
    renderProviders()

    expect(screen.queryByText('content')).not.toBeInTheDocument()
    expect(await screen.findByText('content')).toBeInTheDocument()
  })
})
