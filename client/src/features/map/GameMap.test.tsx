import { screen } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GameMap from './GameMap'
import { TileLoader } from './TileLoader'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const canvas = jest.fn()
jest.mock('./MapCanvas', () => ({
  __esModule: true,
  default: (props: { center?: { x: number; y: number } }) => {
    canvas(props.center)
    return <div>the map</div>
  }
}))

describe('GameMap', () => {
  it('opens the map on the base', async () => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.includes('/map/bots/') ? { data: { x: 7, y: 8 } } : { data: [{ _id: 'b1' }] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    expect(screen.getByText('the map')).toBeInTheDocument()
    await screen.findByText('the map')
    expect(jest.mocked(baseQueryWithRefresh)).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/map/bots/b1' }),
      expect.anything(),
      undefined
    )
    await jest
      .requireActual('@testing-library/react')
      .waitFor(() => expect(canvas).toHaveBeenCalledWith({ x: 7, y: 8 }))
  })

  it('asks for the map again when the number of bots changes', async () => {
    const invalidate = jest.spyOn(TileLoader.prototype, 'invalidate')
    jest
      .mocked(baseQueryWithRefresh)
      .mockImplementation((async (args: { url: string }) =>
        args.url.includes('/map/bots/') ? { data: { x: 1, y: 1 } } : { data: [{ _id: 'b1' }, { _id: 'b2' }] }) as never)

    renderApp(<GameMap baseId="b1" />, { store: storeWithToken(makeJwt(60)) })

    await jest.requireActual('@testing-library/react').waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2))
    invalidate.mockRestore()
  })
})
