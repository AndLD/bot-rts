'use client'

import { MailOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'

export default function ForbiddenPage() {
  const t = useTranslations('auth.forbidden')

  return (
    <div
      style={{
        fontSize: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 50
      }}
    >
      <MailOutlined style={{ fontSize: 100 }} />
      <div>{t('message')}</div>
    </div>
  )
}
