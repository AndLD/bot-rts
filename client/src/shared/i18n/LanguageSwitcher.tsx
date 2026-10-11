'use client'

import { Select } from 'antd'
import { useTranslations } from 'next-intl'
import { isLocale, LOCALES } from './locales'
import { useLocaleState } from './I18nProvider'

const NAMES: Record<(typeof LOCALES)[number], string> = { en: 'English', ru: 'Русский' }

export function LanguageSwitcher() {
  const t = useTranslations('common')
  const { locale, setLocale } = useLocaleState()

  return (
    <Select
      size="small"
      aria-label={t('language')}
      value={locale}
      onChange={(value) => isLocale(value) && setLocale(value)}
      options={LOCALES.map((code) => ({ value: code, label: NAMES[code] }))}
    />
  )
}
