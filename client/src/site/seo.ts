import type { Metadata } from 'next'
import { LOCALES, Locale } from '../shared/i18n/locales'
import { localePath, SITE_URL } from './config'

const OPEN_GRAPH_LOCALES: Record<Locale, string> = { en: 'en_US', ru: 'ru_RU' }

// The alternates of a page in each language, for `hreflang`
export const alternatesOf = (path: string) => ({
  ...Object.fromEntries(LOCALES.map((locale) => [locale, `${SITE_URL}${localePath(locale, path)}`])),
  'x-default': `${SITE_URL}${localePath('en', path)}`
})

interface Page {
  locale: Locale
  // The address inside the language tree, '' for the home page
  path: string
  title: string
  description: string
}

// Title, canonical address, `hreflang` alternates and the Open Graph / Twitter preview of a public page
export function pageMetadata({ locale, path, title, description }: Page): Metadata {
  const url = `${SITE_URL}${localePath(locale, path)}`

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url, languages: alternatesOf(path) },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Bot RTS',
      type: 'website',
      locale: OPEN_GRAPH_LOCALES[locale],
      images: [{ url: `${SITE_URL}/social.png`, width: 1200, height: 630 }]
    },
    twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/social.png`] }
  }
}
