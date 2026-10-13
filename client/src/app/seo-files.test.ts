import { SITE_URL } from '../site/config'
import { PUBLIC_PATHS } from '../site/paths'
import robots from './robots'
import sitemap from './sitemap'

describe('sitemap', () => {
  it('lists every public page in each language with its alternates', () => {
    const entries = sitemap()

    expect(entries).toHaveLength(PUBLIC_PATHS.length * 2)
    expect(entries[0]).toMatchObject({ url: `${SITE_URL}/`, priority: 1 })
    expect(entries[1]).toMatchObject({ url: `${SITE_URL}/ru` })
    expect(entries[0].alternates?.languages).toMatchObject({ ru: `${SITE_URL}/ru` })
  })
})

describe('robots', () => {
  it('lets crawlers read the public pages but not the game, and points at the sitemap', () => {
    expect(robots()).toMatchObject({
      rules: { allow: '/', disallow: ['/game', '/auth', '/account'] },
      sitemap: `${SITE_URL}/sitemap.xml`
    })
  })
})
