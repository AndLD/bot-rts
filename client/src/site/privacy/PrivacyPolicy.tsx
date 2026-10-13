'use client'

import { PRIVACY_POLICY_VERSION } from '@lib/utils/privacy'
import { useTranslations } from 'next-intl'
import { CONTACT_EMAIL } from '../config'

const COLLECTED = ['account', 'game', 'terminal', 'technical'] as const
const SECTIONS = ['purposes', 'cookies', 'retention', 'sharing', 'rights', 'changes', 'contact'] as const

// The privacy policy (design §15.3). The version is the one sign-up accepts; the date inside it is when the text last changed.
export default function PrivacyPolicy() {
  const t = useTranslations('privacy')

  return (
    <article className="site-article">
      <h1>{t('title')}</h1>
      <p className="site-muted">{t('version', { version: PRIVACY_POLICY_VERSION })}</p>
      <p>{t('intro')}</p>
      <section>
        <h2>{t('collected.title')}</h2>
        <ul>
          {COLLECTED.map((item) => (
            <li key={item}>{t(`collected.items.${item}`)}</li>
          ))}
        </ul>
      </section>
      {SECTIONS.map((section) => (
        <section key={section}>
          <h2>{t(`${section}.title`)}</h2>
          <p>{t(`${section}.text`, { email: CONTACT_EMAIL })}</p>
        </section>
      ))}
    </article>
  )
}
