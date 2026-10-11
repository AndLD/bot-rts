'use client'

import '@ant-design/v5-patch-for-react-19'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { Provider } from 'react-redux'
import { usePathname, useRouter } from 'next/navigation'
import { useCurrentUser } from '../features/auth/hooks'
import { AppStore, setupStore } from '../shared/store'
import { resolveRedirect } from './access'

// Sends the visitor to the page that fits who they are
function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useCurrentUser()
  const redirect = resolveRedirect(state, pathname)

  useEffect(() => {
    if (redirect) {
      router.replace(redirect)
    }
  }, [redirect, router])

  return state === 'loading' || redirect ? null : <>{children}</>
}

// The game is a client-side application: it reads the session from the browser, so nothing here renders on the server
export function Providers({ children }: { children: ReactNode }) {
  const store = useRef<AppStore | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => setIsMounted(true), [])

  if (!isMounted) {
    return null
  }

  store.current ??= setupStore()

  return (
    <Provider store={store.current}>
      <RouteGuard>{children}</RouteGuard>
    </Provider>
  )
}
