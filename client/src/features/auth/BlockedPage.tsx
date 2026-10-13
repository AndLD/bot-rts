'use client'

import { StopOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'

export default function BlockedPage() {
  const t = useTranslations('auth.blocked')

  return (
    <div
      style={{
        fontSize: 45,
        padding: 16,
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 50
      }}
    >
      <StopOutlined style={{ fontSize: 100 }} />
      <div>{t('message')}</div>
    </div>
  )
}
