'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'

export function MarketingContent() {
  const t = useTranslations()

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 24
      }}
    >
      <LanguageSwitcher />
      <h1>{t('common.appName')}</h1>
      <p>{t('marketing.tagline')}</p>
      <Link href="/game">{t('marketing.play')}</Link>
    </main>
  )
}
