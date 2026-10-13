import { DOC_EXAMPLES } from '@lib/utils/doc-examples'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import DocLink from './DocLink'
import DocPageView from './DocPageView'
import DocsBrowser from './DocsBrowser'
import { DocsNavigation } from './DocsContext'
import catalogue from './generated/catalogue.json'
import commands from './generated/commands.json'
import api from './generated/script-api.json'
import { searchableTexts, searchDocs, textOfBlock } from './search'
import { DOC_GROUPS, DOC_PAGES, docPath, findDocPage, pagesOfGroup } from './structure'

type Messages = {
  docs: {
    pages: Record<string, Record<string, unknown>>
    api: { functions: Record<string, string> }
    examples: Record<string, unknown>
  }
}

const messagesOf = (language: 'en' | 'ru') => (language === 'en' ? en : ru)

function renderDocs(ui: React.ReactElement, language: 'en' | 'ru' = 'en') {
  return render(
    <NextIntlClientProvider locale={language} messages={language === 'ru' ? { ...en, ...ru } : en} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>
  )
}

const links: DocsNavigation = { hrefOf: (slug) => `/docs/${slug}`, apiUrl: 'http://api.test' }

describe('the structure of the documentation', () => {
  it('has unique addresses, a front page, and pages in every group', () => {
    const slugs = DOC_PAGES.map((page) => page.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    expect(findDocPage('')).toBeDefined()
    for (const group of DOC_GROUPS) {
      expect(pagesOfGroup(group).length).toBeGreaterThan(0)
    }
  })

  it('has the sections the design asks for', () => {
    for (const slug of [
      'getting-started/first-base',
      'getting-started/first-bot',
      'getting-started/first-script',
      'concepts/map',
      'concepts/ticks',
      'concepts/energy',
      'concepts/ops-budget',
      'concepts/weight',
      'api',
      'modules',
      'recipes',
      'botos',
      'examples',
      'public-api',
      'faq'
    ]) {
      expect(findDocPage(slug)).toBeDefined()
    }
  })

  it('only points at pages that exist', () => {
    for (const page of DOC_PAGES) {
      for (const block of page.blocks) {
        if (block.type === 'see') {
          expect(findDocPage(block.slug)).toBeDefined()
        }
      }
    }
  })

  it('writes the address of a page', () => {
    expect(docPath('')).toBe('/docs')
    expect(docPath('api')).toBe('/docs/api')
  })

  it.each(['en', 'ru'] as const)('has every text of every page in %s', (language) => {
    const { docs } = messagesOf(language) as unknown as Messages

    for (const page of DOC_PAGES) {
      const entry = docs.pages[page.id]
      expect(typeof entry?.title).toBe('string')
      for (const block of page.blocks) {
        const keys =
          block.type === 'paragraph' || block.type === 'heading'
            ? [block.key]
            : block.type === 'list' || block.type === 'faq'
              ? block.keys
              : []
        for (const key of keys) {
          const value = entry[key]
          expect(
            typeof value === 'string' || (block.type === 'faq' && typeof (value as { q?: string })?.q === 'string')
          ).toBe(true)
        }
      }
    }
  })

  it.each(['en', 'ru'] as const)('describes every function, example and property in %s', (language) => {
    const { docs } = messagesOf(language) as unknown as Messages & {
      docs: { catalogue: { props: Record<string, string> } }
    }

    for (const fn of api.functions) {
      expect(typeof docs.api.functions[fn.name]).toBe('string')
    }
    for (const example of DOC_EXAMPLES) {
      expect(typeof (docs.examples[example.id] as { title: string }).title).toBe('string')
    }
    for (const module of catalogue.modules) {
      for (const prop of Object.keys(module.props)) {
        expect(typeof docs.catalogue.props[prop]).toBe('string')
      }
    }
  })
})

describe('search', () => {
  const index = [
    { slug: 'a', title: 'Energy', text: 'Every bot has a battery.\nA generator burns oil.' },
    { slug: 'b', title: 'Ticks', text: 'The game advances in ticks.\nEnergy is spent in ticks too.' },
    { slug: 'c', title: 'Map', text: 'A grid of cells that never resets.' }
  ]

  it('finds the pages that hold every word, titles first', () => {
    expect(searchDocs(index, 'energy').map((hit) => hit.slug)).toEqual(['a', 'b'])
    expect(searchDocs(index, 'ticks energy').map((hit) => hit.slug)).toEqual(['b'])
    expect(searchDocs(index, 'GENERATOR OIL').map((hit) => hit.slug)).toEqual(['a'])
  })

  it('finds nothing for an empty query or an unknown word', () => {
    expect(searchDocs(index, '   ')).toEqual([])
    expect(searchDocs(index, 'zebra')).toEqual([])
  })

  it('shows the sentence that matched, shortened around the word', () => {
    expect(searchDocs(index, 'generator')[0].snippet).toBe('A generator burns oil.')

    const long = [{ slug: 'x', title: 'X', text: `${'word '.repeat(40)}needle ${'tail '.repeat(40)}` }]
    const snippet = searchDocs(long, 'needle')[0].snippet
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain('needle')
  })

  it('shows the start of the page when only the title matched', () => {
    expect(searchDocs(index, 'map')[0].snippet).toBe('A grid of cells that never resets.')
  })

  it('reads the texts of every kind of block', () => {
    const text = (key: string) => `<${key}>`

    expect(textOfBlock({ type: 'paragraph', key: 'p' }, text)).toEqual(['<p>'])
    expect(textOfBlock({ type: 'heading', key: 'h' }, text)).toEqual(['<h>'])
    expect(textOfBlock({ type: 'list', keys: ['a', 'b'] }, text)).toEqual(['<a>', '<b>'])
    expect(textOfBlock({ type: 'faq', keys: ['q'] }, text)).toEqual(['<q.q>', '<q.a>'])
    expect(textOfBlock({ type: 'see', slug: 'api' }, text)).toEqual([])
    expect(textOfBlock({ type: 'generated', kind: 'modules' }, text)).toEqual([])
  })

  it('collects the title, the texts and the extras of each page', () => {
    const [entry] = searchableTexts(
      [{ slug: 's', id: 'x', group: 'start', blocks: [{ type: 'paragraph', key: 'p' }] }],
      () => 'Title',
      (_page, key) => `text of ${key}`,
      () => ['extra']
    )

    expect(entry).toEqual({ slug: 's', title: 'Title', text: 'text of p\nextra' })
  })
})

describe('DocPageView', () => {
  it.each(['en', 'ru'] as const)('renders every page in %s', (language) => {
    for (const page of DOC_PAGES) {
      const { unmount } = renderDocs(<DocsBrowser slug={page.slug} navigation={links} />, language)

      expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('shows the texts of a page, the questions as details, and where to read on', () => {
    renderDocs(<DocPageView page={findDocPage('faq') as never} />)

    expect(screen.getByRole('heading', { level: 1, name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByText('Do my bots work when I am away?')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Read next' })).toBeInTheDocument()
  })

  it('shows lists and headings', () => {
    renderDocs(<DocPageView page={findDocPage('getting-started/first-bot') as never} />)

    expect(screen.getByRole('heading', { name: 'What a bot needs' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(6)
  })

  it('lists every function of the script API with the modules that grant it and what it costs', () => {
    renderDocs(<DocPageView page={findDocPage('api') as never} />)

    const move = screen.getByText('move(cells: number): Promise<Result<any>>').closest('tr') as HTMLElement
    expect(within(move).getByText('Moves the bot forward by the given number of cells.')).toBeInTheDocument()
    expect(within(move).getByText('Engine, Wheels')).toBeInTheDocument()
    expect(within(move).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('sleep(ms: number): Promise<void>').closest('tr')).toHaveTextContent('every bot')
    expect(screen.getAllByRole('row')).toHaveLength(api.functions.length + 1)
  })

  it('lists the modules with their numbers, and the recipes with what they cost', () => {
    const { unmount } = renderDocs(<DocPageView page={findDocPage('modules') as never} />)
    const drill = screen.getByText('Drill, class 1').closest('tr') as HTMLElement
    expect(within(drill).getByText(/Material per operation: 5/)).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(catalogue.modules.length + 1)
    unmount()

    renderDocs(<DocPageView page={findDocPage('recipes') as never} />)
    const scanner = screen.getByText('Scanner, class 1').closest('tr') as HTMLElement
    expect(scanner).toHaveTextContent('20 Iron, 5 Crystal')
    expect(scanner).toHaveTextContent('10 s')
    expect(screen.getByText(/costs 5 times the resources of the target recipe and 10 times/)).toBeInTheDocument()
  })

  it('lists the commands and the examples', () => {
    const { unmount } = renderDocs(<DocPageView page={findDocPage('botos') as never} />)
    const craft = screen.getByText('craft <module> [count]').closest('tr') as HTMLElement
    expect(within(craft).getByText('craft modules at the factory')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(commands.commands.length + 1)
    unmount()

    renderDocs(<DocPageView page={findDocPage('examples') as never} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(DOC_EXAMPLES.length)
    expect(screen.getAllByText(/export async function main\(bot\)/)).toHaveLength(DOC_EXAMPLES.length)
    expect(screen.getAllByText(/Needs the modules:/)).toHaveLength(DOC_EXAMPLES.length)
  })

  it('links the OpenAPI reference of the server it is configured for', () => {
    renderDocs(<DocsBrowser slug="public-api" navigation={links} />)

    expect(screen.getByRole('link', { name: 'http://api.test/api/docs' })).toHaveAttribute(
      'href',
      'http://api.test/api/docs'
    )
    expect(screen.getByText('/api/v1')).toBeInTheDocument()
  })

  it('lists every page on the front page', () => {
    renderDocs(<DocsBrowser slug="" navigation={links} />)
    const index = document.querySelector('.doc-index') as HTMLElement

    expect(within(index).getAllByRole('link')).toHaveLength(DOC_PAGES.length - 1)
  })
})

describe('DocsBrowser', () => {
  it('marks the page that is open and links the others by address', () => {
    renderDocs(<DocsBrowser slug="concepts/energy" navigation={links} />)
    const tree = screen.getByRole('navigation', { name: 'Pages' })

    expect(within(tree).getByText('Energy').closest('li')).toHaveAttribute('aria-current', 'page')
    expect(within(tree).getByText('Ticks').closest('a')).toHaveAttribute('href', '/docs/concepts/ticks')
  })

  it('searches the documentation and shows the pages found, then the page again when the query is cleared', () => {
    renderDocs(<DocsBrowser slug="" navigation={links} />)
    const box = screen.getByRole('searchbox', { name: 'Search the documentation' })

    fireEvent.change(box, { target: { value: 'generator' } })
    expect(screen.getByText(/pages?$/)).toBeInTheDocument()
    const results = document.querySelector('.docs-results') as HTMLElement
    expect(within(results).getByText('Energy')).toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'zzzzzz' } })
    expect(screen.getByText('Nothing found')).toBeInTheDocument()

    fireEvent.change(box, { target: { value: '' } })
    expect(screen.getByRole('heading', { level: 1, name: 'Bot RTS documentation' })).toBeInTheDocument()
  })

  it('finds what only the generated parts list: a function, a command, an example, a module', () => {
    renderDocs(<DocsBrowser slug="" navigation={links} />)
    const box = screen.getByRole('searchbox')
    const found = (query: string) => {
      fireEvent.change(box, { target: { value: query } })

      return (document.querySelector('.docs-results') as HTMLElement).textContent as string
    }

    expect(found('getLinkStatus')).toContain('Script API reference')
    expect(found('disassemble')).toContain('BotOS commands')
    expect(found('Patrol')).toContain('Example scripts')
    expect(found('wireless-adapter-class1')).toContain('Module catalogue')
    expect(found('wireless-adapter-class1')).toContain('Recipes')
  })

  it('shows a page in place when links must not leave the place, and clears the search', () => {
    const open = jest.fn()
    renderDocs(<DocsBrowser slug="" navigation={{ ...links, open }} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ticks' } })
    const results = document.querySelector('.docs-results') as HTMLElement
    fireEvent.click(within(results).getAllByRole('link')[0])

    expect(open).toHaveBeenCalledWith(expect.stringMatching(/ticks/))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})

describe('DocLink', () => {
  it('names the page and leaves the click to the browser where links are addresses', () => {
    renderDocs(<DocLink slug="api" />)

    expect(screen.getByRole('link', { name: 'Script API reference' })).toHaveAttribute('href', '/docs/api')
  })

  it('shows nothing for a page that does not exist', () => {
    const { container } = renderDocs(<DocLink slug="nowhere" />)

    expect(container).toBeEmptyDOMElement()
  })
})
