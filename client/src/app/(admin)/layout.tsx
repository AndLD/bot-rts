import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { RootShell } from '../../shared/RootShell'
import { Providers } from '../Providers'

// The console is for admins only and never public, so it is not indexed
export const metadata: Metadata = {
  title: 'Bot RTS admin',
  robots: { index: false, follow: false }
}

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return (
    <RootShell lang="en">
      <I18nProvider>
        <Providers>{children}</Providers>
      </I18nProvider>
    </RootShell>
  )
}
