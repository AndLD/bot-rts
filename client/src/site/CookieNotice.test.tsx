import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { siteMessages } from './siteMessages'
import CookieNotice, { COOKIE_NOTICE_KEY } from './CookieNotice'

const renderNotice = (locale: 'en' | 'ru' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={siteMessages(locale)} timeZone="UTC">
      <CookieNotice locale={locale} />
    </NextIntlClientProvider>
  )

describe('CookieNotice', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => jest.restoreAllMocks())

  it('tells what is stored and links the policy, until the visitor has seen it', async () => {
    renderNotice()

    expect(screen.getByRole('region', { name: 'Cookies and storage' })).toBeInTheDocument()
    expect(screen.getByText(/non-essential cookies stay off/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe('1')
  })

  it('stays away once it was seen', () => {
    localStorage.setItem(COOKIE_NOTICE_KEY, '1')

    renderNotice()

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('links the Russian policy on the Russian pages', () => {
    renderNotice('ru')

    expect(screen.getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute('href', '/ru/privacy')
  })

  it('works when the storage is blocked', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderNotice()

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
