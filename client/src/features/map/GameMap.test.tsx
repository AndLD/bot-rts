import { screen } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderApp, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import GameMap from './GameMap'

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
    jest.mocked(baseQueryWithRefresh).mockResolvedValue({ data: { x: 7, y: 8 } })

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
})
