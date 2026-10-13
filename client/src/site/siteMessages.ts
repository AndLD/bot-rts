import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import { Locale, Messages, withFallback } from '../shared/i18n/locales'

const CATALOGUES: Record<Locale, Messages> = { en, ru: withFallback(en, ru) }

// The public pages are rendered at build time, so the browser gets only the texts they use
const PUBLIC_NAMESPACES = ['common', 'site', 'marketing', 'privacy', 'docs', 'modules', 'map', 'terminal'] as const

export function siteMessages(locale: Locale): Messages {
  const all = CATALOGUES[locale]

  return Object.fromEntries(PUBLIC_NAMESPACES.filter((name) => name in all).map((name) => [name, all[name]]))
}
