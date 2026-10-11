import { createContext, useContext } from 'react'
import { AuthClient } from './auth-client'

export const AuthClientContext = createContext<AuthClient | null>(null)

// The authentication client for components: the only way they reach the provider
export function useAuth(): AuthClient {
  const client = useContext(AuthClientContext)

  if (!client) {
    throw new Error('useAuth must be used inside AuthClientProvider')
  }

  return client
}
