import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RecordingSink } from '../../../tests/fakes/engine'
import { FakeClock } from '../../../tests/fakes/fakes'
import { createEngineWorld } from '../../../tests/fakes/world-engine'
import { KnownPoint } from '../../map/domain/map-point.entity'
import { DEFAULT_RADIO_BALANCE } from '../domain/radio'
import { RadioBuffers } from './radio-buffers'
import { NoSignalError, RadioNetwork } from './radio-network'

const at = (x: number, y = 0) => ({ x, y, z: 0 })
// processor + adapter (range 20) + battery
const KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']
const OWNER = 'alice'

async function setup() {
  const engine = createEngineWorld()
  const sink = new RecordingSink()
  const buffers = new RadioBuffers({ scans: 10, events: 10 })
  const learned: Array<{ userId: string; points: KnownPoint[] }> = []
  const clock = new FakeClock()
  const radio = new RadioNetwork(
    engine.world,
    engine.source,
    sink,
    buffers,
    DEFAULT_RADIO_BALANCE,
    { learn: async (userId, points) => void learned.push({ userId, points }) },
    clock
  )
  engine.addBot('base', at(0), KIT, { ownerId: OWNER, type: BOT_TYPE.BASE })
  const worker = (id: string, x: number, owner = OWNER, baseId = 'base') =>
    engine.addBot(id, at(x), KIT, { ownerId: owner, baseId })
  const tick = async (ms = 1000) => {
    clock.current = new Date(clock.now().getTime() + ms)
    await radio.refresh()
  }
  const games = () => sink.events.flatMap((event) => (event.type === 'game' ? [event.event] : []))
  const changes = () => sink.events.flatMap((event) => (event.type === 'radio' ? event.changes : []))
  const move = async (id: string, x: number) => {
    const bot = (await engine.world.bot(id))!
    await engine.world.place(bot, { x, y: 0, z: 0 })
  }
  const breakAdapter = async (id: string) => {
    const bot = (await engine.world.bot(id))!
    const adapter = bot.state.modules.find((m) => m.type === 'wirelessAdapter')!
    engine.world.updateModules(bot, [{ ...adapter, condition: 0 }])
  }
  return { ...engine, sink, buffers, learned, radio, clock, worker, tick, games, changes, move, breakAdapter }
}

describe('RadioNetwork', () => {
  it('connects the bots in range of the base, directly or through relays, with their signal', async () => {
    const t = await setup()
    t.worker('near', 8)
    t.worker('relay', 15)
    t.worker('behind', 30)

    expect(await t.radio.statusOf(OWNER, 'base')).toEqual({ isConnected: true, signal: 4, hops: 0 })
    expect(await t.radio.statusOf(OWNER, 'near')).toMatchObject({ isConnected: true, signal: 3, hops: 1 })
    // The relay is best reached through `near` (two good links beat one stretched one), so `behind` is three hops away
    expect(await t.radio.statusOf(OWNER, 'relay')).toMatchObject({ hops: 2, signal: 3 })
    expect(await t.radio.statusOf(OWNER, 'behind')).toMatchObject({ isConnected: true, hops: 3, signal: 2 })
    expect((await t.radio.statusOf(OWNER, 'behind')).weakestLink).toMatchObject({ botId: 'behind' })
  })

  it('does not tell anything the first time it looks, only what changes after', async () => {
    const t = await setup()
    t.worker('near', 5)

    await t.radio.statusOf(OWNER, 'near')
    await t.tick()

    expect(t.sink.events).toEqual([])
  })

  it('tells the loss of a link once, with when it was lost, and its return with the summary of what was missed', async () => {
    const t = await setup()
    t.worker('rover', 5)
    await t.radio.statusOf(OWNER, 'rover')

    await t.move('rover', 50)
    await t.tick()
    expect(t.games()).toEqual([{ type: 'LinkLost', userId: OWNER, botId: 'rover', at: expect.any(Number) }])
    expect(t.changes()).toEqual([{ botId: 'rover', isConnected: false, bars: 0, hops: 0 }])
    const status = await t.radio.statusOf(OWNER, 'rover')
    expect(status).toMatchObject({ isConnected: false, signal: 0, lostSince: expect.any(Number) })
    await t.tick()
    expect(t.games()).toHaveLength(1)

    t.buffers.keepScan('rover', {
      id: 'k1',
      userId: OWNER,
      location: at(50),
      type: MapPointType.BOT,
      contentId: null,
      resource: null,
      seenAt: 1234
    })
    t.buffers.keepEvent('rover', { type: 'LinkWeak', userId: OWNER, botId: 'rover', at: 1, bars: 1 })
    await t.move('rover', 6)
    await t.tick()

    expect(t.games()[1]).toMatchObject({
      type: 'LinkRestored',
      botId: 'rover',
      missed: { scans: 1, events: 1, byType: { LinkWeak: 1 } }
    })
    expect(t.learned).toEqual([{ userId: OWNER, points: [expect.objectContaining({ seenAt: 1234 })] }])
    expect((await t.radio.statusOf(OWNER, 'rover')).lostSince).toBeUndefined()
  })

  it('warns when a signal falls to one bar, and reports the bar changes as diffs', async () => {
    const t = await setup()
    t.worker('rover', 2)
    await t.radio.statusOf(OWNER, 'rover')

    await t.move('rover', 10)
    await t.tick()
    expect(t.changes()).toEqual([{ botId: 'rover', isConnected: true, bars: 3, hops: 1 }])
    expect(t.games()).toEqual([])

    await t.move('rover', 19)
    await t.tick()
    expect(t.changes()[1]).toMatchObject({ bars: 1 })
    expect(t.games()).toEqual([expect.objectContaining({ type: 'LinkWeak', botId: 'rover', bars: 1 })])

    await t.move('rover', 18)
    await t.tick()
    expect(t.games()).toHaveLength(1)
  })

  it('loses the bots behind a relay that breaks, and finds them again when it is repaired', async () => {
    const t = await setup()
    t.worker('relay', 15)
    t.worker('behind', 30)
    await t.radio.statusOf(OWNER, 'behind')

    await t.breakAdapter('relay')
    await t.tick()

    expect(t.games().map((e) => `${e.type}:${e.botId}`)).toEqual(['LinkLost:relay', 'LinkLost:behind'])
  })

  it('treats a bot without energy as switched off', async () => {
    const t = await setup()
    t.worker('rover', 5)
    await t.radio.statusOf(OWNER, 'rover')
    const bot = (await t.world.bot('rover'))!
    const battery = bot.state.modules.find((m) => m.type === 'battery')!

    t.world.updateModules(bot, [{ ...battery, props: { ...battery.props, value: 0 } }])
    await t.tick()

    expect(t.games()).toEqual([expect.objectContaining({ type: 'LinkLost', botId: 'rover' })])
  })

  it('counts only the bots of the base, and nothing connects without a living base', async () => {
    const t = await setup()
    t.worker('stranger', 3, 'bob', 'other-base')

    expect((await t.radio.statusOf('bob', 'stranger')).isConnected).toBe(false)
    expect((await t.radio.statusOf(OWNER, 'stranger')).isConnected).toBe(false)

    await t.breakAdapter('base')
    await t.tick()
    expect((await t.radio.statusOf(OWNER, 'base')).isConnected).toBe(false)
  })

  it('refuses control of a bot out of reach with NO_SIGNAL, and lets everything else through', async () => {
    const t = await setup()
    t.worker('near', 5)
    t.worker('lost', 80)

    await expect(t.radio.ensureControl(OWNER, 'near')).resolves.toBeUndefined()
    await expect(t.radio.ensureControl(OWNER, 'base')).resolves.toBeUndefined()
    await expect(t.radio.ensureControl(OWNER, 'lost')).rejects.toBeInstanceOf(NoSignalError)
    await expect(t.radio.ensureControl(OWNER, 'someone-elses')).resolves.toBeUndefined()
  })

  it('knows without computing whether a bot is connected, and starts again after the world is evicted', async () => {
    const t = await setup()
    t.worker('rover', 5)
    expect(t.radio.isConnectedNow(OWNER, 'rover')).toBe(true)
    await t.radio.statusOf(OWNER, 'rover')
    expect(t.radio.isConnectedNow(OWNER, 'rover')).toBe(true)

    t.world.evict()
    await t.tick()
    await t.tick()

    expect(t.sink.events).toEqual([])
    expect((await t.radio.statusOf(OWNER, 'rover')).isConnected).toBe(true)
  })
})
