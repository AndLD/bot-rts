import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import type { ReactNode } from 'react'
import { buttonTheme } from './buttonTheme'
import '../app/global.scss'

// The <html> document of a route group (every group is a root layout): the language is in the markup, so the public pages
// carry it for search engines and the game, which picks its language in the browser, starts in English
export function RootShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang}>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={buttonTheme}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
