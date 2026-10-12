import { RecordingSink } from '../../../tests/fakes/engine'
import { FakeClock } from '../../../tests/fakes/fakes'
import { GameEvent } from '../domain/game-event'
import { EngineAudience } from './engine-audience'
import { EventOutbox } from './event-outbox'
import { GameEventBus } from './game-event-bus'
import { RadioBuffers } from './radio-buffers'

const at = { x: 5, y: 5, z: 0 }

function setup() {
  const outbox = new EventOutbox(new FakeClock())
  const sink = new RecordingSink()
  const buffers = new RadioBuffers({ scans: 10, events: 10 })
  const watchers: Record<string, string[]> = {}
  const connected = new Set<string>(['alice:b1', 'bob:b2'])
  const audience = new EngineAudience(
    { audienceAt: (location) => watchers[`${location.x},${location.y}`] ?? [] },
    { isConnectedNow: (userId, botId) => connected.has(`${userId}:${botId}`) }
  )
  const bus = new GameEventBus(outbox, audience, buffers, sink)
  const heard = () => sink.events.flatMap((e) => (e.type === 'game' ? [`${e.userId}:${e.event.type}`] : []))
  return { outbox, sink, buffers, watchers, connected, bus, heard }
}

const shot = (extra: Partial<GameEvent> = {}): GameEvent =>
  ({
    type: 'ShotHit',
    at: 1,
    parties: [
      { userId: 'alice', botId: 'b1' },
      { userId: 'bob', botId: 'b2' }
    ],
    location: at,
    hits: 1,
    victimBotId: 'b2',
    ...extra
  }) as GameEvent

describe('GameEventBus', () => {
  it('tells every player the event concerns, each once, in a stable order', () => {
    const t = setup()
    t.outbox.publish(shot())

    t.bus.deliver()

    expect(t.heard()).toEqual(['alice:ShotHit', 'bob:ShotHit'])
    t.bus.deliver()
    expect(t.heard()).toHaveLength(2)
  })

  it('tells the players whose live area covers the place, whoever caused it, and nobody twice', () => {
    const t = setup()
    t.watchers['5,5'] = ['bob', 'carol']
    t.outbox.publish(shot())

    t.bus.deliver()

    expect(t.heard()).toEqual(['alice:ShotHit', 'bob:ShotHit', 'carol:ShotHit'])
  })

  it('keeps the news of a bot out of reach for the summary instead of telling its owner', () => {
    const t = setup()
    t.connected.delete('bob:b2')
    t.outbox.publish(shot())

    t.bus.deliver()

    expect(t.heard()).toEqual(['alice:ShotHit'])
    expect(t.buffers.take('b2').events).toHaveLength(1)
  })

  it('still tells the owner the news of the link itself', () => {
    const t = setup()
    t.connected.clear()
    t.outbox.publish({ type: 'LinkLost', at: 1, parties: [{ userId: 'alice', botId: 'b1' }] })

    t.bus.deliver()

    expect(t.heard()).toEqual(['alice:LinkLost'])
    expect(t.buffers.take('b1').events).toEqual([])
  })

  it('tells a party that has no bot, and an event with no place', () => {
    const t = setup()
    t.outbox.publish({ type: 'EnergyLow', at: 1, parties: [{ userId: 'alice', botId: null }] })

    t.bus.deliver()

    expect(t.heard()).toEqual(['alice:EnergyLow'])
  })

  it('stamps events with the game time', () => {
    expect(setup().outbox.now()).toBe(new FakeClock().now().getTime())
  })
})
