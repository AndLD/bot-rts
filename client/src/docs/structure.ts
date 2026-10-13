// The player documentation as data (design §15.5): a tree of pages, each a list of blocks. The texts are translation keys under
// `docs.pages.<id>.<key>`, so the pages exist in every language, and the same structure is shown by the public /docs routes and by
// the Help window of the game: one source, no second copy.

export type DocGroup = 'start' | 'concepts' | 'reference' | 'help'

// What the code produces, rendered from the generated data
export type GeneratedKind = 'index' | 'scriptApi' | 'modules' | 'recipes' | 'commands' | 'examples' | 'publicApi'

export type DocBlock =
  | { type: 'paragraph'; key: string }
  | { type: 'heading'; key: string }
  | { type: 'list'; keys: readonly string[] }
  // Questions and answers: `<key>.q` and `<key>.a`
  | { type: 'faq'; keys: readonly string[] }
  // Where to read on: a page of the documentation
  | { type: 'see'; slug: string }
  | { type: 'generated'; kind: GeneratedKind }

export interface DocPage {
  // The address inside /docs ('' is the front page)
  slug: string
  // The translation key root, and the id of the page in code
  id: string
  group: DocGroup
  blocks: readonly DocBlock[]
}

const paragraphs = (...keys: string[]): DocBlock[] => keys.map((key) => ({ type: 'paragraph', key }))
const list = (...keys: string[]): DocBlock => ({ type: 'list', keys })
const heading = (key: string): DocBlock => ({ type: 'heading', key })
const see = (...slugs: string[]): DocBlock[] => slugs.map((slug) => ({ type: 'see', slug }))

export const DOC_GROUPS: readonly DocGroup[] = ['start', 'concepts', 'reference', 'help']

export const DOC_PAGES: readonly DocPage[] = [
  {
    slug: '',
    id: 'home',
    group: 'start',
    blocks: [...paragraphs('lead'), { type: 'generated', kind: 'index' }]
  },
  {
    slug: 'getting-started/first-base',
    id: 'firstBase',
    group: 'start',
    blocks: [
      ...paragraphs('intro'),
      list('step1', 'step2', 'step3', 'step4'),
      ...paragraphs('outro'),
      ...see('getting-started/first-bot')
    ]
  },
  {
    slug: 'getting-started/first-bot',
    id: 'firstBot',
    group: 'start',
    blocks: [
      ...paragraphs('intro'),
      heading('partsTitle'),
      list('part1', 'part2', 'part3', 'part4'),
      heading('howTitle'),
      list('how1', 'how2', 'how3'),
      ...paragraphs('outro'),
      ...see('modules', 'recipes', 'getting-started/first-script')
    ]
  },
  {
    slug: 'getting-started/first-script',
    id: 'firstScript',
    group: 'start',
    blocks: [
      ...paragraphs('intro'),
      list('step1', 'step2', 'step3', 'step4'),
      ...paragraphs('outro'),
      ...see('examples', 'api', 'concepts/ops-budget')
    ]
  },
  {
    slug: 'concepts/map',
    id: 'map',
    group: 'concepts',
    blocks: [
      ...paragraphs('intro'),
      heading('fogTitle'),
      ...paragraphs('fog'),
      heading('liveTitle'),
      ...paragraphs('live'),
      ...see('concepts/ticks')
    ]
  },
  {
    slug: 'concepts/ticks',
    id: 'ticks',
    group: 'concepts',
    blocks: [...paragraphs('intro', 'order', 'result'), ...see('concepts/ops-budget', 'concepts/energy')]
  },
  {
    slug: 'concepts/energy',
    id: 'energy',
    group: 'concepts',
    blocks: [
      ...paragraphs('intro'),
      list('idle', 'operation', 'battery', 'generator', 'solar'),
      ...paragraphs('empty'),
      ...see('modules')
    ]
  },
  {
    slug: 'concepts/ops-budget',
    id: 'opsBudget',
    group: 'concepts',
    blocks: [...paragraphs('intro', 'cost', 'free', 'slice'), ...see('api', 'concepts/ticks')]
  },
  {
    slug: 'concepts/weight',
    id: 'weight',
    group: 'concepts',
    blocks: [...paragraphs('intro', 'speed', 'assembly'), ...see('modules')]
  },
  {
    slug: 'api',
    id: 'api',
    group: 'reference',
    blocks: [...paragraphs('intro', 'result'), { type: 'generated', kind: 'scriptApi' }, ...see('examples')]
  },
  {
    slug: 'modules',
    id: 'modules',
    group: 'reference',
    blocks: [...paragraphs('intro'), { type: 'generated', kind: 'modules' }, ...see('recipes', 'concepts/weight')]
  },
  {
    slug: 'recipes',
    id: 'recipes',
    group: 'reference',
    blocks: [...paragraphs('intro', 'research'), { type: 'generated', kind: 'recipes' }, ...see('modules')]
  },
  {
    slug: 'botos',
    id: 'botos',
    group: 'reference',
    blocks: [...paragraphs('intro'), { type: 'generated', kind: 'commands' }, ...see('getting-started/first-script')]
  },
  {
    slug: 'examples',
    id: 'examples',
    group: 'reference',
    blocks: [...paragraphs('intro'), { type: 'generated', kind: 'examples' }, ...see('api')]
  },
  {
    slug: 'public-api',
    id: 'publicApi',
    group: 'reference',
    blocks: [...paragraphs('intro'), { type: 'generated', kind: 'publicApi' }]
  },
  {
    slug: 'faq',
    id: 'faq',
    group: 'help',
    blocks: [
      { type: 'faq', keys: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] },
      ...see('getting-started/first-base', 'concepts/map', 'concepts/energy')
    ]
  }
]

const BY_SLUG = new Map(DOC_PAGES.map((page) => [page.slug, page]))

export const findDocPage = (slug: string): DocPage | undefined => BY_SLUG.get(slug)

export const docPath = (slug: string) => (slug === '' ? '/docs' : `/docs/${slug}`)

// The pages of a group, in order
export const pagesOfGroup = (group: DocGroup): DocPage[] => DOC_PAGES.filter((page) => page.group === group)
