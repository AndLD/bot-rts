'use client'

import { ReactNode, useMemo } from 'react'
import type { AppStore } from '../../shared/store'
import { AuthClientContext } from './auth-client-context'
import { createLocalAuthClient } from './local-auth-client'

// AUTH_PROVIDER on the server decides which provider issues the tokens; `local` is the only one so far, and a hosted
// provider would add its own client here
export function AuthClientProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  const client = useMemo(() => createLocalAuthClient(store), [store])

  return <AuthClientContext.Provider value={client}>{children}</AuthClientContext.Provider>
}
