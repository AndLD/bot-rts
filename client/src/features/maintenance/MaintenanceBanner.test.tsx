import { screen } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import MaintenanceBanner from './MaintenanceBanner'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

const start = Date.UTC(2026, 5, 1, 12)
const serve = (data: unknown) => query.mockReset().mockResolvedValue({ data } as never)
const opts = () => ({ store: storeWithToken(makeJwt(60)) })

describe('MaintenanceBanner', () => {
  it('shows nothing while the world runs and no maintenance is announced', async () => {
    serve({ isPaused: false, banner: null })
    const { container } = renderApp(<MaintenanceBanner />, opts())

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the banner with when maintenance starts, and when it should end', async () => {
    serve({ isPaused: false, banner: { message: 'Down for an hour', startsAt: start, endsAt: start + 3_600_000 } })
    renderApp(<MaintenanceBanner />, opts())

    expect(await screen.findByText('Down for an hour')).toBeInTheDocument()
    expect(screen.getByText(/^From .* to /)).toBeInTheDocument()
  })

  it('shows a banner without an end, and that the world is paused', async () => {
    serve({ isPaused: true, banner: { message: 'Back soon', startsAt: start, endsAt: null } })
    renderApp(<MaintenanceBanner />, opts())

    expect(await screen.findByText('The world is paused for maintenance.')).toBeInTheDocument()
    expect(screen.getByText(/^From /)).toBeInTheDocument()
    expect(screen.queryByText(/ to /)).not.toBeInTheDocument()
  })

  it('shows that the world is paused when there is no banner', async () => {
    serve({ isPaused: true, banner: null })
    renderApp(<MaintenanceBanner />, opts())

    expect(await screen.findByText('The world is paused for maintenance.')).toBeInTheDocument()
  })
})
