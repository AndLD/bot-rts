import { render, screen } from '@testing-library/react'
import { SitePage } from './SitePage'

describe('SitePage', () => {
  it('stands the content between the header and the footer, in the language of the page', () => {
    render(
      <SitePage locale="ru" path="/docs">
        <p>content</p>
      </SitePage>
    )

    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/auth')
    expect(screen.getByRole('link', { name: 'Регистрация' })).toHaveAttribute('href', '/auth?mode=signup')
    expect(screen.getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute('href', '/ru/privacy')
  })

  it('links the same page in the other language and marks the current one', () => {
    render(
      <SitePage locale="en" path="/docs">
        <p>content</p>
      </SitePage>
    )

    expect(screen.getByRole('link', { name: 'Русский' })).toHaveAttribute('href', '/ru/docs')
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Русский' })).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('link', { name: 'Docs' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'API' })[0]).toHaveAttribute('href', '/docs/api')
  })
})
