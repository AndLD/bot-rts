import type { Metadata } from 'next'
import type { Locale } from '../../shared/i18n/locales'
import { pageMetadata } from '../seo'
import { siteMessages } from '../siteMessages'
import { SitePage } from '../SitePage'
import PrivacyPolicy from './PrivacyPolicy'

export function privacyMetadata(locale: Locale): Metadata {
  const { meta } = siteMessages(locale).privacy as { meta: { title: string; description: string } }

  return pageMetadata({ locale, path: '/privacy', ...meta })
}

export function PrivacyView({ locale }: { locale: Locale }) {
  return (
    <SitePage locale={locale} path="/privacy">
      <PrivacyPolicy />
    </SitePage>
  )
}
