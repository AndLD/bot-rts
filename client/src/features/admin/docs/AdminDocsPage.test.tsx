import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../../messages/en.json'
import AdminDocsPage from './AdminDocsPage'
import AdminHelpLink from './AdminHelpLink'

let slug: string[] | undefined
let pathname = '/admin'
jest.mock('next/navigation', () => ({
  useParams: () => ({ slug }),
  usePathname: () => pathname
}))

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>
  )

beforeEach(() => {
  slug = undefined
  pathname = '/admin'
})

describe('AdminDocsPage', () => {
  it('opens on the front page, with the roles and the tree of pages', () => {
    wrap(<AdminDocsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Admin console' })).toBeInTheDocument()
    expect(screen.getByText(/Owner: everything/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Permissions' })[0]).toHaveAttribute('href', '/admin/docs/permissions')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/admin/docs/players')
    expect(screen.getAllByRole('link', { name: 'Signing in' }).length).toBeGreaterThan(0)
  })

  it('shows a page of the console with what can be done there, and where to read on', () => {
    slug = ['supervision']
    wrap(<AdminDocsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Supervision' })).toBeInTheDocument()
    expect(screen.getByText('What you can do')).toBeInTheDocument()
    expect(screen.getByText(/Quarantine a player/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Maintenance' }).length).toBeGreaterThan(0)
  })

  it('writes the permissions, the audited actions and the alert thresholds from the code', () => {
    slug = ['permissions']
    const { unmount } = wrap(<AdminDocsPage />)
    expect(screen.getByText('players.ban')).toBeInTheDocument()
    expect(screen.getAllByText('✓').length).toBeGreaterThan(10)
    unmount()

    slug = ['audit-actions']
    const actions = wrap(<AdminDocsPage />)
    expect(screen.getByText('players.ban')).toBeInTheDocument()
    expect(screen.getByText('balance.save')).toBeInTheDocument()
    actions.unmount()

    slug = ['alerts']
    wrap(<AdminDocsPage />)
    expect(screen.getByText('engine.tickP95Ratio')).toBeInTheDocument()
    expect(screen.getAllByText('above').length).toBeGreaterThan(0)
    expect(screen.getAllByText('below').length).toBeGreaterThan(0)
  })

  it('shows the front page for an address that has no page', () => {
    slug = ['nope', 'nothing']
    wrap(<AdminDocsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Admin console' })).toBeInTheDocument()
  })

  it('searches the pages, names what matched, and says when nothing did', () => {
    wrap(<AdminDocsPage />)
    const box = screen.getByLabelText('Search the admin documentation')

    fireEvent.change(box, { target: { value: 'kill-switch' } })
    expect(screen.getByText(/pages? found/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Supervision' }).length).toBeGreaterThan(0)

    fireEvent.click(
      screen.getAllByRole('link', { name: 'Supervision' })[
        screen.getAllByRole('link', { name: 'Supervision' }).length - 1
      ]
    )
    expect(screen.queryByText(/pages? found/)).not.toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'qqqqzzzz' } })
    expect(screen.getByText('Nothing found')).toBeInTheDocument()
  })
})

describe('AdminHelpLink', () => {
  it('opens the documentation of the page the admin is on, and the front page elsewhere', () => {
    pathname = '/admin/players/abc'
    const { unmount } = wrap(<AdminHelpLink />)
    expect(screen.getByRole('link', { name: 'Help for this page' })).toHaveAttribute('href', '/admin/docs/players')
    unmount()

    pathname = '/somewhere'
    wrap(<AdminHelpLink />)
    expect(screen.getByRole('link', { name: 'Help for this page' })).toHaveAttribute('href', '/admin/docs')
  })
})
