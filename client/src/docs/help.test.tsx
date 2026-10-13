import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJwt } from '../../tests/jwt'
import { renderApp, storeWithToken } from '../../tests/render'
import HelpPanel from '../features/help/HelpPanel'
import { baseQueryWithRefresh } from '../shared/store/baseQuery'
import { setupStore } from '../shared/store'
import HelpLink from './HelpLink'
import { HELP_TOPICS, helpSlugOf } from './help'
import { helpSlice, showHelp } from './help.slice'
import ModuleHelpName from './ModuleHelpName'
import { findDocPage } from './structure'

jest.mock('../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

describe('help topics', () => {
  it('lead to pages that exist', () => {
    for (const slug of Object.values(HELP_TOPICS)) {
      expect(findDocPage(slug)).toBeDefined()
    }
  })

  it('are found whatever the case and the spaces, and are null for what is not a topic', () => {
    expect(helpSlugOf('api')).toBe('api')
    expect(helpSlugOf('  Energy ')).toBe('concepts/energy')
    expect(helpSlugOf('commands')).toBe('botos')
    expect(helpSlugOf('nonsense')).toBeNull()
    expect(helpSlugOf('constructor')).toBeNull()
  })
})

describe('the help slice', () => {
  it('counts every request, so asking again for the same page is a new request', () => {
    const first = helpSlice.reducer(undefined, showHelp('api'))
    const second = helpSlice.reducer(first, showHelp('api'))

    expect(first).toEqual({ slug: 'api', request: 1 })
    expect(second).toEqual({ slug: 'api', request: 2 })
  })
})

describe('HelpLink', () => {
  it('opens the Help window at the page, once, and asks for the page again each time', () => {
    const store = setupStore()
    renderApp(<HelpLink slug="concepts/energy" />, { store })

    fireEvent.click(screen.getByRole('button', { name: 'Open the help page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the help page' }))

    expect(store.getState().help).toEqual({ slug: 'concepts/energy', request: 2 })
    expect(store.getState().windows.windows.filter((window) => window.kind === 'help')).toHaveLength(1)
  })
})

describe('ModuleHelpName', () => {
  it("names the module in the player's language, and offers the catalogue in a tooltip", async () => {
    renderApp(<ModuleHelpName module="drill-class2" />)

    expect(screen.getByText('Drill, class 2')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByText('Drill, class 2'))

    expect(await screen.findByRole('button', { name: 'Open the help page' })).toBeInTheDocument()
  })
})

describe('HelpPanel', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockResolvedValue({ data: {} } as never)
  })

  it('shows the documentation in the window, from the front page, with its links staying in the window', () => {
    renderApp(<HelpPanel />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.getByRole('heading', { level: 1, name: 'Bot RTS documentation' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('link', { name: 'Energy' })[0])

    expect(screen.getByRole('heading', { level: 1, name: 'Energy' })).toBeInTheDocument()
  })

  it('goes to the page that another part of the game asked for, each time it asks', () => {
    const store = storeWithToken(makeJwt(60))
    renderApp(<HelpPanel />, { store })

    store.dispatch(showHelp('concepts/ticks'))
    return waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Ticks' })).toBeInTheDocument()).then(
      () => {
        fireEvent.click(screen.getAllByRole('link', { name: 'Energy' })[0])
        expect(screen.getByRole('heading', { level: 1, name: 'Energy' })).toBeInTheDocument()

        store.dispatch(showHelp('concepts/ticks'))

        return waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Ticks' })).toBeInTheDocument())
      }
    )
  })

  it('searches the documentation', () => {
    renderApp(<HelpPanel />, { store: storeWithToken(makeJwt(60)) })

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sleep' } })

    expect(document.querySelector('.docs-results')?.textContent).toContain('Script API reference')
  })

  it('brings the tutorial back', async () => {
    renderApp(<HelpPanel />, { store: storeWithToken(makeJwt(60)) })

    fireEvent.click(screen.getByRole('button', { name: 'Show the tutorial again' }))

    await waitFor(() =>
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/v1/tutorial/restart', method: 'POST' }),
        expect.anything(),
        undefined
      )
    )
  })
})
