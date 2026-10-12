import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { GameEvent } from '../domain/game-event'
import { RadioBuffers } from './radio-buffers'

const sighting = (x: number, seenAt: number) => ({
  id: `k${x}`,
  userId: 'u',
  location: { x, y: 0, z: 0 },
  type: MapPointType.BOT,
  contentId: null,
  resource: null,
  seenAt
})
const event = (botId: string): GameEvent => ({ type: 'LinkWeak', at: 1, parties: [{ userId: 'u', botId }], bars: 1 })

describe('RadioBuffers', () => {
  it('keeps the newest sighting of each cell and hands everything over once', () => {
    const buffers = new RadioBuffers({ scans: 10, events: 10 })
    buffers.keepScan('b1', sighting(1, 100))
    buffers.keepScan('b1', sighting(2, 110))
    buffers.keepScan('b1', sighting(1, 120))
    buffers.keepEvent('b1', event('b1'))

    const { scans, events } = buffers.take('b1')

    expect(scans.map((s) => [s.location.x, s.seenAt])).toEqual([
      [2, 110],
      [1, 120]
    ])
    expect(events).toHaveLength(1)
    expect(buffers.take('b1')).toEqual({ scans: [], events: [] })
    expect(buffers.take('other')).toEqual({ scans: [], events: [] })
  })

  it('drops the oldest sightings and events when a buffer is full', () => {
    const buffers = new RadioBuffers({ scans: 2, events: 2 })
    for (let x = 1; x <= 4; x++) buffers.keepScan('b1', sighting(x, x))
    for (const botId of ['a', 'b', 'c']) buffers.keepEvent('b1', event(botId))

    const { scans, events } = buffers.take('b1')

    expect(scans.map((s) => s.location.x)).toEqual([3, 4])
    expect(events.map((e) => e.parties[0].botId)).toEqual(['b', 'c'])
  })

  it('keeps the buffers of different bots apart', () => {
    const buffers = new RadioBuffers({ scans: 5, events: 5 })
    buffers.keepScan('b1', sighting(1, 1))
    buffers.keepEvent('b2', event('b2'))

    expect(buffers.take('b2').scans).toEqual([])
    expect(buffers.take('b1').events).toEqual([])
  })
})
