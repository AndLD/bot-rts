import { render, screen } from '@testing-library/react'
import { createFakeAuth } from '../../../tests/render'
import { setupStore } from '../../shared/store'
import { AuthClientContext, useAuth } from './auth-client-context'
import { AuthClientProvider } from './AuthClientProvider'

function Probe() {
  return <span>{typeof useAuth().signIn}</span>
}

describe('useAuth', () => {
  it('returns the client of the provider', () => {
    render(
      <AuthClientContext.Provider value={createFakeAuth()}>
        <Probe />
      </AuthClientContext.Provider>
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('refuses to work outside a provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthClientProvider')
  })
})

describe('AuthClientProvider', () => {
  it('provides the local client for the store', () => {
    render(
      <AuthClientProvider store={setupStore()}>
        <Probe />
      </AuthClientProvider>
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })
})
