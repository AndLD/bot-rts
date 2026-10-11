import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import type { ReactNode } from 'react'
import { I18nProvider } from '../shared/i18n/I18nProvider'
import './global.scss'

export const metadata: Metadata = {
  title: 'Bot RTS',
  description: 'A real-time strategy game where you program your bots'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <I18nProvider>{children}</I18nProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
