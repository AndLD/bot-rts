'use client'

import { NextIntlClientProvider } from 'next-intl'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from '../../../messages/en.json'
import ru from '../../../messages/ru.json'
import { DEFAULT_LOCALE, detectLocale, Locale, LOCALE_STORAGE_KEY, Messages, withFallback } from './locales'

const CATALOGUES: Record<Locale, Messages> = { en, ru: withFallback(en, ru) }

interface LocaleState {
  locale: Locale
  setLocale(locale: Locale): void
}

const LocaleContext = createContext<LocaleState>({ locale: DEFAULT_LOCALE, setLocale: () => undefined })

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

// The language is chosen in the browser (a saved choice, then the browser language), so pages render in English first
// and switch right after mount
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(detectLocale({ stored: readStoredLocale(), languages: navigator.languages }))
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // The choice then lasts until the page is closed
    }
  }, [])

  const state = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return (
    <LocaleContext.Provider value={state}>
      <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}

export function useLocaleState(): LocaleState {
  return useContext(LocaleContext)
}
