'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SocketProvider } from '../../shared/socket/SocketProvider'
import Terminal from '../terminal/Terminal'

export default function GamePage() {
  const t = useTranslations('game')

  return (
    <SocketProvider>
      <div
        style={{
          height: '100vh',
          maxHeight: '100vh',
          width: '100vw',
          maxWidth: '100vw',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Link href="/account" style={{ position: 'absolute', top: 12, right: 16, color: '#999', zIndex: 1 }}>
          {t('account')}
        </Link>
        <Terminal />
      </div>
    </SocketProvider>
  )
}
