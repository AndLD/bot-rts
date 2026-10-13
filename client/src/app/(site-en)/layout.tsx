import type { ReactNode } from 'react'
import { RootShell } from '../../shared/RootShell'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>
}
