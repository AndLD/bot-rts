import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import FactoryPanel from './FactoryPanel'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const recipes = [
  {
    module: 'storage-class1',
    classLevel: 1,
    resources: [{ resource: 'crystal', amount: 5 }],
    craftTimeMs: 10000,
    isKnown: true,
    canResearch: false,
    research: null
  },
  {
    module: 'gun-class1',
    classLevel: 1,
    resources: [{ resource: 'iron', amount: 50 }],
    craftTimeMs: 20000,
    isKnown: true,
    canResearch: false,
    research: null
  },
  {
    module: 'drill-class1',
    classLevel: 1,
    resources: [{ resource: 'iron', amount: 400 }],
    craftTimeMs: 20000,
    isKnown: true,
    canResearch: false,
    research: null
  },
  {
    module: 'gun-class2',
    classLevel: 2,
    resources: [{ resource: 'iron', amount: 100 }],
    craftTimeMs: 40000,
    isKnown: false,
    canResearch: true,
    research: { resources: [{ resource: 'iron', amount: 500 }], timeMs: 400000 }
  },
  {
    module: 'scanner-class2',
    classLevel: 2,
    resources: [{ resource: 'iron', amount: 40 }],
    craftTimeMs: 20000,
    isKnown: false,
    canResearch: true,
    research: { resources: [{ resource: 'iron', amount: 100 }], timeMs: 2000 }
  },
  {
    module: 'battery-class2',
    classLevel: 2,
    resources: [],
    craftTimeMs: 1,
    isKnown: false,
    canResearch: false,
    research: null
  }
]
const storage = {
  capacity: 200,
  used: 150,
  resources: [{ resource: 'iron', amount: 150 }],
  items: [],
  carriedWeight: 0,
  loadCapacity: 0
}
const status = {
  now: 1_000_000,
  jobs: [
    { kind: 'craft', module: 'gun-class1', readyAt: 1_005_000 },
    { kind: 'research', module: 'scanner-class2', readyAt: 900_000 }
  ],
  parts: [
    { _id: 'p1', type: 'part', name: 'engine-class1', weight: 1 },
    { _id: 'p2', type: 'part', name: 'wheels-class1', weight: 1 }
  ],
  blueprintItems: [{ _id: 'bp1', type: 'blueprint', name: 'laser-class3', weight: 0.1 }]
}

let posts: Array<{ url: string; body: unknown }>

function setup(overrides: { status?: object; failPosts?: boolean; failure?: object } = {}) {
  posts = []
  query.mockReset()
  query.mockImplementation((async (args: { url: string; method?: string; body?: unknown }) => {
    if (args.method === 'POST') {
      posts.push({ url: args.url, body: args.body })
      return overrides.failPosts
        ? { error: overrides.failure ?? { status: 409, data: { code: 'EMPTY' } } }
        : { data: [] }
    }
    if (args.url.endsWith('/factory')) return { data: overrides.status ?? status }
    if (args.url.endsWith('/storage')) return { data: storage }
    return { data: recipes }
  }) as never)

  return renderApp(<FactoryPanel baseId="b1" />, { store: storeWithToken(makeJwt(60)) })
}

// Queries by role are slow on a page this big, so buttons and boxes are found by their text
const button = (name: string) => screen.getByText(name, { selector: 'button span' }).closest('button') as HTMLElement
const tab = (name: string) => screen.findByText(name, { selector: '[role=tab]' })

const lastPost = (suffix: string) => posts.find((post) => post.url.endsWith(suffix))

describe('FactoryPanel', () => {
  it('waits for the factory', () => {
    query.mockReset()
    query.mockReturnValue(new Promise(() => undefined) as never)
    renderApp(<FactoryPanel baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the jobs with the time left, the recipes with their costs and the blueprints found', async () => {
    setup()

    expect(await screen.findByText(/Crafting Gun, class 1/)).toHaveTextContent('ready in')
    expect(screen.getByText(/Researching Scanner, class 2/)).toHaveTextContent('ready')
    expect(screen.getByText('Laser-class3', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Iron 50').length).toBeGreaterThan(0)
  })

  it('crafts as many as asked, when the base can pay', async () => {
    setup()
    await screen.findByText('Recipes')

    const gun = screen.getByText('Gun, class 1', { selector: 'strong' }).closest('.factory-recipe') as HTMLElement
    fireEvent.change(within(gun).getByRole('spinbutton'), { target: { value: '2' } })
    fireEvent.click(within(gun).getByText('Craft', { selector: 'button span' }).closest('button') as HTMLElement)

    await waitFor(() => expect(lastPost('/factory/craft')?.body).toEqual({ module: 'gun-class1', count: 2 }))
    expect(await screen.findByText('Crafting Gun, class 1', { selector: '[role=status]' })).toBeInTheDocument()
  })

  it('goes back to one when the count is cleared', async () => {
    setup()
    await screen.findByText('Recipes')

    const gun = screen.getByText('Gun, class 1', { selector: 'strong' }).closest('.factory-recipe') as HTMLElement
    fireEvent.change(within(gun).getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.change(within(gun).getByRole('spinbutton'), { target: { value: '' } })
    fireEvent.click(within(gun).getByText('Craft', { selector: 'button span' }))

    await waitFor(() => expect(lastPost('/factory/craft')?.body).toEqual({ module: 'gun-class1', count: 1 }))
  })

  it('does not offer to craft what the base cannot pay for, and marks the missing resource', async () => {
    setup()
    await screen.findByText('Recipes')

    const drill = screen.getByText('Drill, class 1', { selector: 'strong' }).closest('.factory-recipe') as HTMLElement

    expect(
      within(drill).getByText('Craft', { selector: 'button span' }).closest('button') as HTMLElement
    ).toBeDisabled()
  })

  it('researches what can be researched and affordably', async () => {
    setup()
    await screen.findByText('Recipes')

    const gun2 = screen.getByText('Gun, class 2', { selector: 'strong' }).closest('.factory-recipe') as HTMLElement
    expect(
      within(gun2).getByText('Research', { selector: 'button span' }).closest('button') as HTMLElement
    ).toBeDisabled()

    const scanner2 = screen
      .getByText('Scanner, class 2', { selector: 'strong' })
      .closest('.factory-recipe') as HTMLElement
    fireEvent.click(
      within(scanner2).getByText('Research', { selector: 'button span' }).closest('button') as HTMLElement
    )

    await waitFor(() => expect(lastPost('/factory/research')?.body).toEqual({ module: 'scanner-class2' }))
  })

  it('learns a blueprint that was found', async () => {
    setup()

    fireEvent.click(await screen.findByText('Learn', { selector: 'button span' }))

    await waitFor(() => expect(lastPost('/factory/learn')?.body).toEqual({ itemId: 'bp1' }))
  })

  it('assembles a bot from the chosen parts, with a name', async () => {
    setup()
    fireEvent.click(await tab('Assemble'))
    expect(button('Assemble a bot')).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Engine, class 1'))
    fireEvent.click(screen.getByLabelText('Wheels, class 1'))
    fireEvent.change(screen.getByLabelText('Name of the bot'), { target: { value: 'Scout' } })
    fireEvent.click(button('Assemble a bot'))

    await waitFor(() => expect(lastPost('/factory/assemble')?.body).toEqual({ label: 'Scout', partIds: ['p1', 'p2'] }))
    expect(await screen.findByText('The bot is assembled')).toBeInTheDocument()
    expect(screen.getByLabelText('Name of the bot')).toHaveValue('')
  })

  it('assembles without a name', async () => {
    setup()
    fireEvent.click(await tab('Assemble'))

    fireEvent.click(screen.getByLabelText('Engine, class 1'))
    fireEvent.click(button('Assemble a bot'))

    await waitFor(() => expect(lastPost('/factory/assemble')?.body).toEqual({ partIds: ['p1'] }))
  })

  it('says there are no parts yet', async () => {
    setup({ status: { ...status, parts: [], jobs: [], blueprintItems: [] } })
    fireEvent.click(await tab('Assemble'))

    expect(screen.getByText('No finished modules yet: craft some first')).toBeInTheDocument()
  })

  it('says when a request is refused, and keeps the choice', async () => {
    setup({ failPosts: true })
    fireEvent.click(await tab('Assemble'))
    fireEvent.click(screen.getByLabelText('Engine, class 1'))

    fireEvent.click(button('Assemble a bot'))

    expect(await screen.findByText('It did not work (EMPTY)')).toBeInTheDocument()
    expect(screen.getByLabelText('Engine, class 1')).toBeChecked()
  })

  it('copes with a refusal that says nothing about its reason', async () => {
    setup({ failPosts: true, failure: { status: 500 } })
    fireEvent.click(await screen.findByText('Learn', { selector: 'button span' }))

    expect(await screen.findByText('It did not work ()')).toBeInTheDocument()
  })
})
