import { PRIVACY_POLICY_VERSION } from '@lib/utils/privacy'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { CONTACT_EMAIL } from '../config'
import { siteMessages } from '../siteMessages'
import PrivacyPolicy from './PrivacyPolicy'
import { privacyMetadata, PrivacyView } from './PrivacyView'

function renderPolicy(locale: 'en' | 'ru') {
  return render(
    <NextIntlClientProvider locale={locale} messages={siteMessages(locale)} timeZone="UTC">
      <PrivacyPolicy />
    </NextIntlClientProvider>
  )
}

describe('PrivacyPolicy', () => {
  it('says what is collected, why, for how long, who gets it, the rights, and how to write', () => {
    renderPolicy('en')

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
    for (const heading of [
      'What we collect',
      'Why we collect it',
      'Cookies and browser storage',
      'How long we keep it',
      'Who receives it',
      'Your rights',
      'Changes',
      'Contact'
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/account email|email address/i)).toBeInTheDocument()
    expect(screen.getByText(/^Terminal logs:/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Questions about your data: ${CONTACT_EMAIL}`))).toBeInTheDocument()
  })

  it('shows the version that sign-up accepts', () => {
    renderPolicy('en')

    expect(screen.getByText(`Version ${PRIVACY_POLICY_VERSION}`)).toBeInTheDocument()
  })

  it('is available in Russian', () => {
    renderPolicy('ru')

    expect(screen.getByRole('heading', { level: 1, name: 'Политика конфиденциальности' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ваши права' })).toBeInTheDocument()
  })
})

describe('PrivacyView', () => {
  it('stands in the public page and has metadata of its language', () => {
    render(<PrivacyView locale="ru" />)

    expect(screen.getAllByRole('link', { name: 'Политика конфиденциальности' }).length).toBeGreaterThan(0)
    expect(privacyMetadata('ru').alternates?.canonical).toMatch(/\/ru\/privacy$/)
    expect(privacyMetadata('en').title).toBe('Privacy policy — Bot RTS')
  })
})
