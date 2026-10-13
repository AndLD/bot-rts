import type { Locale } from '../shared/i18n/locales'

// The public address of the site, for canonical links, the sitemap and social previews
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')

// Where players write about their data (the privacy policy names it)
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'privacy@botrts.example'

// The public pages are static, one tree per language: English at the root, Russian under /ru (design §15.3)
export const localePath = (locale: Locale, path = '') => {
  const prefix = locale === 'en' ? '' : '/ru'
  const full = `${prefix}${path}`

  return full === '' ? '/' : full
}
