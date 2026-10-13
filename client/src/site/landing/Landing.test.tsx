import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { siteMessages } from '../siteMessages'
import Landing, { SHOWCASE_SCRIPT } from './Landing'
import { landingMetadata, LandingView } from './LandingView'
import { landingStructuredData } from './structuredData'

jest.mock('../LazyAmbient', () => ({ __esModule: true, default: () => <div data-testid="lazy-ambient" /> }))

function renderLanding(locale: 'en' | 'ru') {
  return render(
    <NextIntlClientProvider locale={locale} messages={siteMessages(locale)} timeZone="UTC">
      <Landing locale={locale} />
    </NextIntlClientProvider>
  )
}

describe('Landing', () => {
  it('presents the game, how it works, its features, a script, questions and the way in', () => {
    renderLanding('en')

    expect(screen.getByRole('heading', { level: 1, name: 'Program your bots. Conquer the map.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(7)
    expect(screen.getByRole('heading', { name: 'Modules' })).toBeInTheDocument()
    expect(screen.getByLabelText('Example script')).toHaveTextContent('bot.dig()')
    expect(SHOWCASE_SCRIPT).toContain('main(bot)')
    expect(screen.getByText('Is it free?')).toBeInTheDocument()
    expect(screen.getByTestId('lazy-ambient')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Play for free' })).toHaveAttribute('href', '/auth?mode=signup')
    expect(screen.getByRole('link', { name: 'Read the docs' })).toHaveAttribute('href', '/docs')
    expect(screen.getByRole('link', { name: 'More example scripts' })).toHaveAttribute('href', '/docs/examples')
  })

  it('has a static poster for the first paint', () => {
    renderLanding('en')

    expect(document.querySelector('img.landing-poster')).toHaveAttribute('src', '/poster.svg')
  })

  it('speaks Russian on the Russian page', () => {
    renderLanding('ru')

    expect(screen.getByRole('heading', { level: 1, name: 'Программируй ботов. Захвати карту.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Читать документацию' })).toHaveAttribute('href', '/ru/docs')
  })
})

describe('LandingView', () => {
  it('adds structured data and the metadata of its language', () => {
    const { container } = render(<LandingView locale="ru" />)
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')

    expect(data['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual(['WebSite', 'VideoGame'])
    expect(landingMetadata('ru').title).toMatch(/Bot RTS/)
    expect(landingMetadata('ru').description).toMatch(/браузер/)
    expect(landingMetadata('en').alternates?.languages).toHaveProperty('ru')
  })
})

describe('landingStructuredData', () => {
  it('names the game, its language and that it is free', () => {
    const data = landingStructuredData('en', 'D')

    expect(data['@graph'][1]).toMatchObject({ '@type': 'VideoGame', description: 'D', inLanguage: 'en' })
    expect(data['@graph'][1]).toMatchObject({ offers: { price: '0' } })
  })
})
