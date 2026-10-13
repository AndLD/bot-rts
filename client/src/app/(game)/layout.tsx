import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { RootShell } from '../../shared/RootShell'
import { Providers } from '../Providers'

export const metadata: Metadata = {
  title: 'Bot RTS',
  description: 'A real-time strategy game where you program your bots',
  robots: { index: false }
}

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <RootShell lang="en">
      <I18nProvider>
        <Providers>{children}</Providers>
      </I18nProvider>
    </RootShell>
  )
}
