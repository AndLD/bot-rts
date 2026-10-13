'use client'

import { DOC_EXAMPLES } from '@lib/utils/doc-examples'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Locale } from '../../shared/i18n/locales'
import { localePath } from '../config'
import LazyAmbient from '../LazyAmbient'

const STEPS = ['build', 'program', 'compete'] as const
const FEATURES = ['modules', 'scripts', 'manual', 'world'] as const
const QUESTIONS = ['free', 'language', 'offline', 'api', 'phone'] as const

// The showcase is the miner of the example gallery, which the sandbox tests run
export const SHOWCASE_SCRIPT = (DOC_EXAMPLES.find((example) => example.id === 'miner') as { code: string }).code

export default function Landing({ locale }: { locale: Locale }) {
  const t = useTranslations('marketing')

  return (
    <>
      <section className="landing-hero">
        <img className="landing-poster" src="/poster.svg" alt="" width={640} height={384} fetchPriority="high" />
        <LazyAmbient />
        <div className="landing-shade" />
        <div className="landing-hero-text">
          <h1>{t('hero.title')}</h1>
          <p>{t('hero.subtitle')}</p>
          <div className="landing-actions">
            <Link href="/auth?mode=signup" className="site-button site-button-primary site-button-large">
              {t('hero.play')}
            </Link>
            <Link href={localePath(locale, '/docs')} className="site-button site-button-large">
              {t('hero.docs')}
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="how">
        <h2 id="how">{t('how.title')}</h2>
        <ol className="landing-grid landing-steps">
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="landing-number">{index + 1}</span>
              <h3>{t(`how.steps.${step}.title`)}</h3>
              <p>{t(`how.steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section" aria-labelledby="features">
        <h2 id="features">{t('features.title')}</h2>
        <ul className="landing-grid landing-features">
          {FEATURES.map((feature) => (
            <li key={feature}>
              <h3>{t(`features.items.${feature}.title`)}</h3>
              <p>{t(`features.items.${feature}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section landing-showcase" aria-labelledby="showcase">
        <div>
          <h2 id="showcase">{t('showcase.title')}</h2>
          <p>{t('showcase.text')}</p>
          <Link href={localePath(locale, '/docs/examples')}>{t('showcase.more')}</Link>
        </div>
        <pre className="landing-code" aria-label={t('showcase.codeLabel')}>
          <code>{SHOWCASE_SCRIPT}</code>
        </pre>
      </section>

      <section className="landing-section" aria-labelledby="faq">
        <h2 id="faq">{t('faq.title')}</h2>
        <div className="landing-faq">
          {QUESTIONS.map((question) => (
            <details key={question}>
              <summary>{t(`faq.items.${question}.q`)}</summary>
              <p>{t(`faq.items.${question}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-section landing-final">
        <h2>{t('cta.title')}</h2>
        <Link href="/auth?mode=signup" className="site-button site-button-primary site-button-large">
          {t('cta.button')}
        </Link>
      </section>
    </>
  )
}
