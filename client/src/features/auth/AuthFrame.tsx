'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher'
import { useLocaleState } from '../../shared/i18n/I18nProvider'
import CookieNotice from '../../site/CookieNotice'
import AmbientCanvas from '../ambient/AmbientCanvas'
import './AuthPage.scss'

interface Props {
  children: ReactNode
  // The language choice is offered where the player decides things; a link-result page is a dead end and has none
  hasLanguage?: boolean
}

// What every sign-in page stands on: the live ambient scene of the landing page behind a card (design §15.3)
export default function AuthFrame({ children, hasLanguage = true }: Props) {
  const t = useTranslations('common')
  const { locale } = useLocaleState()

  return (
    <div className="auth-page">
      <AmbientCanvas />
      <div className="auth-shade" />
      <div className="auth-top">
        <Link href="/" className="auth-brand">
          {t('appName')}
        </Link>
        {hasLanguage && <LanguageSwitcher />}
      </div>
      <div className="auth-card">{children}</div>
      <CookieNotice locale={locale} />
    </div>
  )
}
