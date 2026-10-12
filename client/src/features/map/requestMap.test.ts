import { requestMap } from './requestMap'

const range = { minX: 0, minY: 0, maxX: 1, maxY: 1 }

describe('requestMap', () => {
  it('resolves with the view', async () => {
    const view = { now: 1, cells: [], liveAreas: [] }
    const socket = { emit: jest.fn((_e, _r, ack) => ack(view)) }

    await expect(requestMap(socket as never, range)).resolves.toBe(view)
    expect(socket.emit).toHaveBeenCalledWith('get-map', range, expect.any(Function))
  })

  it('rejects with the error', async () => {
    const socket = { emit: jest.fn((_e, _r, ack) => ack(null, { code: 400, msg: 'bad' })) }

    await expect(requestMap(socket as never, range)).rejects.toEqual({ code: 400, msg: 'bad' })
  })
})
