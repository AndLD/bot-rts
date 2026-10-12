import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import TutorialOverlay from './TutorialOverlay'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const STEPS = ['openTerminal', 'listModules', 'scan', 'writeScript', 'runScript', 'craft', 'assemble']
const tutorial = (status: string, done: string[]) => ({
  status,
  steps: STEPS.map((id) => ({ id, isDone: done.includes(id) })),
  current: status === 'active' ? (STEPS.find((id) => !done.includes(id)) ?? null) : null
})

let current: ReturnType<typeof tutorial>
let posts: string[]

function setup(initial: ReturnType<typeof tutorial>) {
  current = initial
  posts = []
  query.mockReset()
  query.mockImplementation((async (args: { url: string; method?: string }) => {
    if (args.method === 'POST') {
      posts.push(args.url)
      current = tutorial(
        'skipped',
        current.steps.filter((s) => s.isDone).map((s) => s.id)
      )
    }
    return { data: current }
  }) as never)

  return renderApp(<TutorialOverlay />, { store: storeWithToken(makeJwt(60)) })
}

describe('TutorialOverlay', () => {
  it('lists the steps with the done ones ticked and a hint for the one to do', async () => {
    setup(tutorial('active', ['openTerminal']))

    expect(await screen.findByText('Getting started')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(7)
    expect(items[0]).toHaveAttribute('data-done', 'true')
    expect(items[1]).toHaveAttribute('data-current', 'true')
    expect(screen.getByText('Type modules in the terminal.')).toBeInTheDocument()
    expect(
      screen.queryByText('Open the factory and craft a module, for example wheels or an engine.')
    ).not.toBeInTheDocument()
  })

  it('can be skipped at any time, and then goes away', async () => {
    setup(tutorial('active', []))

    fireEvent.click(await screen.findByRole('button', { name: 'Skip the tutorial' }))

    await waitFor(() => expect(posts).toEqual(['/api/v1/tutorial/skip']))
    await waitFor(() => expect(screen.queryByText('Getting started')).not.toBeInTheDocument())
  })

  it('shows nothing before it knows, for a skipped tutorial, or for one finished long ago', async () => {
    setup(tutorial('skipped', ['scan']))
    await waitFor(() => expect(query).toHaveBeenCalled())
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows nothing for a tutorial finished in an earlier visit', async () => {
    setup(tutorial('completed', STEPS))
    await waitFor(() => expect(query).toHaveBeenCalled())

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('says it is completed when the player finishes it, and can be closed', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    setup(tutorial('active', STEPS.slice(0, 6)))
    await screen.findByText('Getting started')

    current = tutorial('completed', STEPS)
    jest.advanceTimersByTime(4500)

    expect(await screen.findByText('Tutorial completed. The world is yours.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    jest.useRealTimers()
  })
})
