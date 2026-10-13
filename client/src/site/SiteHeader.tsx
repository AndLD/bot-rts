'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LOCALES, Locale } from '../shared/i18n/locales'
import { localePath } from './config'

const NAMES: Record<Locale, string> = { en: 'English', ru: 'Русский' }

interface Props {
  locale: Locale
  // The address of the page inside the language tree, so the language links lead to the same page
  path: string
}

export default function SiteHeader({ locale, path }: Props) {
  const t = useTranslations('site')

  return (
    <header className="site-header">
      <Link href={localePath(locale)} className="site-brand">
        {t('brand')}
      </Link>
      <nav className="site-nav" aria-label={t('navigation')}>
        <Link href={localePath(locale, '/docs')}>{t('docs')}</Link>
        <Link href={localePath(locale, '/docs/api')}>{t('api')}</Link>
        <span className="site-languages" role="group" aria-label={t('language')}>
          {LOCALES.map((code) => (
            <Link
              key={code}
              href={localePath(code, path)}
              hrefLang={code}
              lang={code}
              aria-current={code === locale ? 'true' : undefined}
            >
              {NAMES[code]}
            </Link>
          ))}
        </span>
        <Link href="/auth" className="site-button">
          {t('login')}
        </Link>
        <Link href="/auth?mode=signup" className="site-button site-button-primary">
          {t('signup')}
        </Link>
      </nav>
    </header>
  )
}
