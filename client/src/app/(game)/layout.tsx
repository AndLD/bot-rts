import type { ReactNode } from 'react'
import { Providers } from '../Providers'

export default function GameLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>
}
