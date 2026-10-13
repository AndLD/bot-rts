import { GameEvent } from '../../engine/domain/game-event'
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, COUNTERS } from './achievement-definitions'
import { countersOf } from './counting'

const base = { at: 1, parties: [{ userId: 'u', botId: 'b' }] as GameEvent['parties'] }

describe('countersOf', () => {
  it.each<[GameEvent, object]>([
    [{ ...base, type: 'BaseDeployed' }, { basesDeployed: 1 }],
    [{ ...base, type: 'ExecutionFinished', executionId: 'e' }, { scriptRuns: 1 }],
    [{ ...base, type: 'ExecutionFailed', executionId: 'e', reason: 'x' }, { scriptRuns: 1 }],
    [{ ...base, type: 'ScanCompleted', cells: 9 }, { cellsScanned: 9 }],
    [{ ...base, type: 'ResourceMined', resource: 'iron', amount: 5 }, { unitsMined: 5 }],
    [{ ...base, type: 'CraftOrdered', module: 'm', count: 3, readyAt: 1 }, { modulesCrafted: 3 }],
    [{ ...base, type: 'BotAssembled', newBotId: 'n' }, { botsAssembled: 1 }],
    [{ ...base, type: 'ModuleRepaired', targetBotId: 't', moduleId: 'm' }, { modulesRepaired: 1 }],
    [{ ...base, type: 'ModuleDisassembled', targetBotId: 't', moduleId: 'm' }, { modulesDisassembled: 1 }],
    [{ ...base, type: 'BotAdopted', adoptedBotId: 'a' }, { botsAdopted: 1 }],
    [{ ...base, type: 'ShotHit', hits: 2, victimBotId: 'v' }, { shotsHit: 2 }],
    [{ ...base, type: 'BotMoved', from: { x: 1, y: 1, z: 0 }, to: { x: 4, y: 2, z: 0 } }, { cellsTravelled: 3 }]
  ])('counts %j', (event, expected) => {
    expect(countersOf(event)).toEqual(expected)
  })

  it('counts nothing for an event no achievement is about', () => {
    expect(countersOf({ ...base, type: 'EnergyLow' })).toEqual({})
  })
})

describe('the achievements', () => {
  it('have unique ids, and every counter is one the game counts', () => {
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ACHIEVEMENTS.every((achievement) => COUNTERS.includes(achievement.counter))).toBe(true)
  })

  it('make one achievement per level, named by the family when there is one level', () => {
    const prospector = ACHIEVEMENTS.filter((achievement) => achievement.family === 'prospector')

    expect(prospector.map((achievement) => achievement.id)).toEqual(['prospector.1', 'prospector.2', 'prospector.3'])
    expect(prospector.map((achievement) => achievement.levels)).toEqual([3, 3, 3])
    expect(ACHIEVEMENTS.find((achievement) => achievement.family === 'firstSteps')?.id).toBe('firstSteps')
  })

  it('have thresholds that grow within a family', () => {
    for (const { thresholds } of ACHIEVEMENT_FAMILIES) {
      expect([...thresholds].sort((a, b) => a - b)).toEqual([...thresholds])
    }
  })
})
