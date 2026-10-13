'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Locale } from '../shared/i18n/locales'
import { localePath } from './config'

export default function SiteFooter({ locale }: { locale: Locale }) {
  const t = useTranslations('site')

  return (
    <footer className="site-footer">
      <span>{t('copyright')}</span>
      <nav aria-label={t('footer')}>
        <Link href={localePath(locale, '/docs')}>{t('docs')}</Link>
        <Link href={localePath(locale, '/docs/api')}>{t('api')}</Link>
        <Link href={localePath(locale, '/privacy')}>{t('privacy')}</Link>
      </nav>
    </footer>
  )
}
