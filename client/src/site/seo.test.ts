import { localePath, SITE_URL } from './config'
import { alternatesOf, pageMetadata } from './seo'

describe('localePath', () => {
  it('keeps English at the root and puts Russian under /ru', () => {
    expect(localePath('en')).toBe('/')
    expect(localePath('ru')).toBe('/ru')
    expect(localePath('en', '/docs')).toBe('/docs')
    expect(localePath('ru', '/docs')).toBe('/ru/docs')
  })
})

describe('alternatesOf', () => {
  it('names the page in every language, and the default', () => {
    expect(alternatesOf('/docs')).toEqual({
      en: `${SITE_URL}/docs`,
      ru: `${SITE_URL}/ru/docs`,
      'x-default': `${SITE_URL}/docs`
    })
  })
})

describe('pageMetadata', () => {
  it('describes the page for search engines and social previews', () => {
    const metadata = pageMetadata({ locale: 'ru', path: '', title: 'T', description: 'D' })

    expect(metadata.title).toBe('T')
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/ru`)
    expect(metadata.alternates?.languages).toMatchObject({ en: `${SITE_URL}/` })
    expect(metadata.openGraph).toMatchObject({ locale: 'ru_RU', url: `${SITE_URL}/ru`, title: 'T', description: 'D' })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })
})
