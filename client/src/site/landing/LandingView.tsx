import type { Metadata } from 'next'
import type { Locale } from '../../shared/i18n/locales'
import { siteMessages } from '../siteMessages'
import { pageMetadata } from '../seo'
import { SitePage } from '../SitePage'
import Landing from './Landing'
import { landingStructuredData } from './structuredData'

const metaOf = (locale: Locale) =>
  (siteMessages(locale).marketing as { meta: { title: string; description: string } }).meta

export function landingMetadata(locale: Locale): Metadata {
  return pageMetadata({ locale, path: '', ...metaOf(locale) })
}

export function LandingView({ locale }: { locale: Locale }) {
  return (
    <SitePage locale={locale} path="">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData(locale, metaOf(locale).description)) }}
      />
      <Landing locale={locale} />
    </SitePage>
  )
}
