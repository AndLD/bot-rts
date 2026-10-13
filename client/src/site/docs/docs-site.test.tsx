import { render, screen } from '@testing-library/react'
import { DOC_PAGES } from '../../docs/structure'
import { PUBLIC_PATHS } from '../paths'
import { docsMetadata, DocsView, docSlugs } from './DocsView'

describe('the documentation on the public pages', () => {
  it('has a static address for each page, the front page being the empty one', () => {
    const slugs = docSlugs()

    expect(slugs).toHaveLength(DOC_PAGES.length)
    expect(slugs).toContainEqual([])
    expect(slugs).toContainEqual(['getting-started', 'first-base'])
    expect(slugs).toContainEqual(['api'])
  })

  it('is in the sitemap, with the front page and every page under it', () => {
    expect(PUBLIC_PATHS).toEqual(expect.arrayContaining(['/docs', '/docs/api', '/docs/concepts/energy']))
  })

  it('describes a page for search engines, in its language, with its alternates', () => {
    const metadata = docsMetadata('ru', ['concepts', 'energy'])

    expect(metadata.title).toBe('Энергия — Документация — Bot RTS')
    expect(metadata.alternates?.canonical).toMatch(/\/ru\/docs\/concepts\/energy$/)
    expect(metadata.alternates?.languages).toMatchObject({ en: expect.stringMatching(/\/docs\/concepts\/energy$/) })
    expect(docsMetadata('en', undefined).title).toBe('Bot RTS documentation — Documentation — Bot RTS')
    expect(docsMetadata('en', ['api']).description).toMatch(/exports main\(bot\)/)
  })

  it('describes a page that has no lead by the title of the documentation', () => {
    expect(docsMetadata('en', ['faq']).description).toBe('Documentation')
  })

  it('has nothing to say about a page that does not exist', () => {
    expect(docsMetadata('en', ['nowhere'])).toEqual({})
  })

  it('stands the documentation in the public page, linking within the language tree', () => {
    render(<DocsView locale="ru" slugParts={['concepts', 'ticks']} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Такты' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Энергия' })[0]).toHaveAttribute('href', '/ru/docs/concepts/energy')
    expect(screen.getAllByRole('link', { name: 'English' })[0]).toHaveAttribute('href', '/docs/concepts/ticks')
  })

  it('shows the front page for no address', () => {
    render(<DocsView locale="en" slugParts={undefined} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Bot RTS documentation' })).toBeInTheDocument()
  })
})
