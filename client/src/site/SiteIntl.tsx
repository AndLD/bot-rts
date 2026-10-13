'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import type { Locale, Messages } from '../shared/i18n/locales'

// The texts of the page, handed down from the server render so the browser gets only the ones the public pages use
export function SiteIntl({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}
