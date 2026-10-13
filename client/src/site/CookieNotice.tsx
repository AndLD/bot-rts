'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { Locale } from '../shared/i18n/locales'
import { localePath } from './config'

export const COOKIE_NOTICE_KEY = 'cookie-notice-seen'

const wasSeen = () => {
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) === '1'
  } catch {
    return false
  }
}

// Tells the visitor what the site stores (design §15.3). Only what the site needs to work is ever set, so there is nothing to
// switch on: the notice is information, and non-essential cookies stay off whatever the visitor answers.
export default function CookieNotice({ locale }: { locale: Locale }) {
  const t = useTranslations('site.cookie')
  const [isVisible, setVisible] = useState(false)

  useEffect(() => setVisible(!wasSeen()), [])

  if (!isVisible) {
    return null
  }

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, '1')
    } catch {
      // The notice then comes back on the next visit
    }
    setVisible(false)
  }

  return (
    <aside className="cookie-notice" role="region" aria-label={t('label')}>
      <p>
        {t('text')} <Link href={localePath(locale, '/privacy')}>{t('more')}</Link>
      </p>
      <button type="button" className="site-button" onClick={dismiss}>
        {t('ok')}
      </button>
    </aside>
  )
}
