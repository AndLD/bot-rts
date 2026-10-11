import { act, render, screen } from '@testing-library/react'
import { useTranslations } from 'next-intl'
import { I18nProvider, useLocaleState } from './I18nProvider'

function Probe() {
  const t = useTranslations('common')
  const { locale, setLocale } = useLocaleState()

  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span data-testid="text">{t('appName')}</span>
      <button onClick={() => setLocale('ru')}>russian</button>
    </>
  )
}

function mockLanguages(languages: string[]) {
  jest.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages)
}

describe('I18nProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  it('uses the browser language when nothing was chosen', () => {
    mockLanguages(['ru-RU'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('ru')
    expect(document.documentElement.lang).toBe('ru')
  })

  it('uses the saved choice before the browser language', () => {
    mockLanguages(['ru'])
    localStorage.setItem('locale', 'en')

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })

  it('falls back to the English text for a missing translation', () => {
    mockLanguages(['en'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )
    act(() => screen.getByText('russian').click())

    expect(screen.getByTestId('text')).toHaveTextContent('Bot RTS')
  })

  it('remembers the chosen language', () => {
    mockLanguages(['en'])

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )
    act(() => screen.getByText('russian').click())

    expect(localStorage.getItem('locale')).toBe('ru')
  })

  it('works when the storage is blocked', () => {
    mockLanguages(['en'])
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )
    act(() => screen.getByText('russian').click())

    expect(screen.getByTestId('locale')).toHaveTextContent('ru')
  })

  it('has a harmless default outside the provider', () => {
    const Bare = () => {
      const { locale, setLocale } = useLocaleState()
      setLocale('ru')

      return <span>{locale}</span>
    }

    render(<Bare />)

    expect(screen.getByText('en')).toBeInTheDocument()
  })
})
