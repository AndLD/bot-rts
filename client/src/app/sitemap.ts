import type { MetadataRoute } from 'next'
import { LOCALES } from '../shared/i18n/locales'
import { localePath, SITE_URL } from '../site/config'
import { alternatesOf } from '../site/seo'
import { PUBLIC_PATHS } from '../site/paths'

// Every public page in each language, each with its alternates (`hreflang`)
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.6,
      alternates: { languages: alternatesOf(path) }
    }))
  )
}
