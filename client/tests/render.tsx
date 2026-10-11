import { render, renderHook, RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'
import messages from '../messages/en.json'
import { AuthClient } from '../src/features/auth/auth-client'
import { AuthClientContext } from '../src/features/auth/auth-client-context'
import { AppStore, setupStore } from '../src/shared/store'

export function createFakeAuth(overrides: Partial<AuthClient> = {}): jest.Mocked<AuthClient> {
  const ok = () => Promise.resolve({ ok: true as const })

  return {
    signIn: jest.fn(ok),
    signUp: jest.fn(ok),
    signOut: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(() => Promise.resolve('refreshed-token')),
    verifyEmail: jest.fn(ok),
    resendVerification: jest.fn(ok),
    requestPasswordReset: jest.fn(ok),
    resetPassword: jest.fn(ok),
    changePassword: jest.fn(ok),
    requestEmailChange: jest.fn(ok),
    confirmEmailChange: jest.fn(ok),
    requestAccountDeletion: jest.fn(ok),
    confirmAccountDeletion: jest.fn(ok),
    ...overrides
  } as jest.Mocked<AuthClient>
}

interface AppOptions {
  auth?: AuthClient
  store?: AppStore
}

// Wraps the UI in what the real app provides: English texts, the Redux store and the auth client
function createWrapper({ auth = createFakeAuth(), store = setupStore() }: AppOptions = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Provider store={store}>
          <AuthClientContext.Provider value={auth}>{children}</AuthClientContext.Provider>
        </Provider>
      </NextIntlClientProvider>
    )
  }
}

export function renderApp(ui: ReactElement, options: AppOptions & Omit<RenderOptions, 'wrapper'> = {}) {
  const { auth, store, ...renderOptions } = options

  return render(ui, { wrapper: createWrapper({ auth, store }), ...renderOptions })
}

export function renderAppHook<T>(hook: () => T, options: AppOptions = {}) {
  return renderHook(hook, { wrapper: createWrapper(options) })
}

export function storeWithToken(token: string | null): AppStore {
  if (token) {
    localStorage.setItem('token', token)
  }

  return setupStore()
}
