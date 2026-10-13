import type { Locale } from '../../shared/i18n/locales'
import { localePath, SITE_URL } from '../config'

// The schema.org description of the game and the site, for search engines (JSON-LD)
export function landingStructuredData(locale: Locale, description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Bot RTS',
        url: `${SITE_URL}${localePath(locale)}`,
        inLanguage: locale
      },
      {
        '@type': 'VideoGame',
        name: 'Bot RTS',
        description,
        url: `${SITE_URL}${localePath(locale)}`,
        inLanguage: locale,
        genre: ['Real-time strategy', 'Programming game'],
        gamePlatform: 'Web browser',
        applicationCategory: 'Game',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      }
    ]
  }
}
