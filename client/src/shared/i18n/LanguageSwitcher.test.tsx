import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from './I18nProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  afterEach(() => localStorage.clear())

  it('shows the current language and switches to another one', async () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    )

    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByTitle('English')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }))
    await userEvent.click(await screen.findByText('Русский'))

    expect(localStorage.getItem('locale')).toBe('ru')
    expect(document.documentElement.lang).toBe('ru')
  })
})
