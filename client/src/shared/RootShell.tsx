import { AntdRegistry } from '@ant-design/nextjs-registry'
import type { ReactNode } from 'react'
import '../app/global.scss'

// The <html> document of a route group (every group is a root layout): the language is in the markup, so the public pages
// carry it for search engines and the game, which picks its language in the browser, starts in English
export function RootShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang}>
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}
