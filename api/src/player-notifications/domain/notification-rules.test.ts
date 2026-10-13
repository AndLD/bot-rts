import { GameEvent } from '../../engine/domain/game-event'
import { candidatesOf } from './notification-rules'

const mine = [{ userId: 'alice', botId: 'b1' }] as GameEvent['parties']

describe('candidatesOf', () => {
  it('tells a player their bot is under attack, also when they shot it themselves, but not the one who shot', () => {
    const shot: GameEvent = {
      type: 'ShotHit',
      at: 1,
      parties: [
        { userId: 'bob', botId: 'b9' },
        { userId: 'alice', botId: 'b1' }
      ],
      hits: 2,
      victimBotId: 'b1'
    }

    expect(candidatesOf('alice', shot)).toEqual([
      { category: 'attacks', kind: 'underAttack', botId: 'b1', params: { hits: 2 }, isCoalesced: true }
    ])
    expect(candidatesOf('bob', shot)).toEqual([])
    expect(
      candidatesOf('alice', {
        ...shot,
        parties: [
          { userId: 'alice', botId: 'b2' },
          { userId: 'alice', botId: 'b1' }
        ]
      })
    ).toHaveLength(1)
  })

  it.each<[GameEvent, string, string, boolean]>([
    [{ type: 'ModuleBroken', at: 1, parties: mine, moduleId: 'm' }, 'damage', 'moduleBroken', false],
    [{ type: 'EnergyLow', at: 1, parties: mine }, 'damage', 'energyLow', true],
    [{ type: 'OutOfFuel', at: 1, parties: mine, moduleId: 'm' }, 'damage', 'outOfFuel', true],
    [{ type: 'LiveScanStopped', at: 1, parties: mine, moduleId: 'm' }, 'damage', 'liveScanStopped', false],
    [{ type: 'LinkLost', at: 1, parties: mine }, 'damage', 'linkLost', true],
    [
      { type: 'LinkRestored', at: 1, parties: mine, missed: { scans: 0, events: 0, byType: {} } },
      'damage',
      'linkRestored',
      false
    ],
    [{ type: 'LinkWeak', at: 1, parties: mine, bars: 1 }, 'damage', 'linkWeak', true],
    [{ type: 'ExecutionFinished', at: 1, parties: mine, executionId: 'e' }, 'scripts', 'scriptFinished', true],
    [
      { type: 'ExecutionFailed', at: 1, parties: mine, executionId: 'e', reason: 'boom' },
      'scripts',
      'scriptFailed',
      true
    ],
    [{ type: 'PasswordAttemptFailed', at: 1, parties: mine, isLockedOut: true }, 'security', 'passwordFailed', true],
    [{ type: 'BotAssembled', at: 1, parties: mine, newBotId: 'n' }, 'fabrication', 'botAssembled', false]
  ])('tells the owner of %j', (event, category, kind, isCoalesced) => {
    const [candidate] = candidatesOf('alice', event)

    expect(candidate).toMatchObject({ category, kind, isCoalesced })
    expect(candidatesOf('bob', event)).toEqual([])
  })

  it('names the bot a notification is about, and what it says', () => {
    expect(candidatesOf('alice', { type: 'LinkWeak', at: 1, parties: mine, bars: 2 })[0]).toMatchObject({
      botId: 'b1',
      params: { bars: 2 }
    })
    expect(candidatesOf('alice', { type: 'BotAssembled', at: 1, parties: mine, newBotId: 'n' })[0]).toMatchObject({
      botId: 'n'
    })
    expect(
      candidatesOf('alice', { type: 'ExecutionFailed', at: 1, parties: mine, executionId: 'e', reason: 'boom' })[0]
        .params
    ).toEqual({ reason: 'boom' })
  })

  it("does not tell a player of a craft or a research that is someone else's", () => {
    const craft: GameEvent = { type: 'CraftOrdered', at: 1, parties: mine, module: 'drill', count: 1, readyAt: 9 }
    const research: GameEvent = { type: 'ResearchOrdered', at: 1, parties: mine, module: 'gun', readyAt: 9 }

    expect(candidatesOf('bob', craft)).toEqual([])
    expect(candidatesOf('bob', research)).toEqual([])
  })

  it('waits for the factory to finish before telling of a craft or a research', () => {
    const craft = candidatesOf('alice', {
      type: 'CraftOrdered',
      at: 1,
      parties: mine,
      module: 'drill',
      count: 2,
      readyAt: 9000
    })
    const research = candidatesOf('alice', {
      type: 'ResearchOrdered',
      at: 1,
      parties: mine,
      module: 'gun',
      readyAt: 7000
    })

    expect(craft).toEqual([
      expect.objectContaining({
        category: 'fabrication',
        kind: 'craftDone',
        params: { module: 'drill', count: 2 },
        dueAt: 9000
      })
    ])
    expect(research).toEqual([
      expect.objectContaining({ kind: 'researchDone', params: { module: 'gun' }, dueAt: 7000 })
    ])
  })

  it('has nothing to tell of an event that is only an animation', () => {
    expect(candidatesOf('alice', { type: 'ResourceMined', at: 1, parties: mine, resource: 'iron', amount: 5 })).toEqual(
      []
    )
    expect(
      candidatesOf('alice', { type: 'ShotFired', at: 1, parties: mine, target: { x: 1, y: 1, z: 0 }, rounds: 1 })
    ).toEqual([])
  })
})
