import { worldActionEvents } from './world-action-events'

const at = 1234

describe('worldActionEvents', () => {
  it('tells of a deployed base, with the base as the bot of the event', () => {
    expect(
      worldActionEvents('bots.deployUserBase', [{ id: 'u1', name: 'U' }, {}], { bot: { id: 'base-1' } }, at)
    ).toEqual([{ type: 'BaseDeployed', at, parties: [{ userId: 'u1', botId: 'base-1' }] }])
  })

  it('tells of an order to the factory, when it will be ready', () => {
    const jobs = [
      { kind: 'craft', module: 'drill-class1', readyAt: 10 },
      { kind: 'craft', module: 'drill-class1', readyAt: 25 }
    ]

    expect(worldActionEvents('factory.craft', ['u1', 'base-1', 'drill-class1', 2], jobs, at)).toEqual([
      {
        type: 'CraftOrdered',
        at,
        module: 'drill-class1',
        count: 2,
        readyAt: 25,
        parties: [{ userId: 'u1', botId: 'base-1' }]
      }
    ])
    expect(worldActionEvents('factory.research', ['u1', 'base-1', 'gun-class2'], { readyAt: 40 }, at)).toEqual([
      { type: 'ResearchOrdered', at, module: 'gun-class2', readyAt: 40, parties: [{ userId: 'u1', botId: 'base-1' }] }
    ])
  })

  it('tells of an assembled bot, repairs, disassembly and an adopted bot', () => {
    expect(
      worldActionEvents('assembly.assemble', ['u1', { baseId: 'base-1', partIds: [] }], { bot: { id: 'bot-9' } }, at)
    ).toEqual([{ type: 'BotAssembled', at, newBotId: 'bot-9', parties: [{ userId: 'u1', botId: 'base-1' }] }])

    const order = { repairerId: 'rep-1', targetBotId: 'bot-2', moduleId: 'm-1' }
    expect(worldActionEvents('maintenance.repair', ['u1', order], {}, at)).toEqual([
      { type: 'ModuleRepaired', at, targetBotId: 'bot-2', moduleId: 'm-1', parties: [{ userId: 'u1', botId: 'rep-1' }] }
    ])
    expect(worldActionEvents('maintenance.disassemble', ['u1', order], {}, at)).toEqual([
      {
        type: 'ModuleDisassembled',
        at,
        targetBotId: 'bot-2',
        moduleId: 'm-1',
        parties: [{ userId: 'u1', botId: 'rep-1' }]
      }
    ])
    expect(worldActionEvents('access.adopt', ['u1', 'bot-1', 'stale-1'], {}, at)).toEqual([
      { type: 'BotAdopted', at, adoptedBotId: 'stale-1', parties: [{ userId: 'u1', botId: 'bot-1' }] }
    ])
  })

  it('has nothing to tell of an action that is not worth an event', () => {
    expect(worldActionEvents('files.write', ['u1', 'bot-1', 'a.js', ''], {}, at)).toEqual([])
    expect(worldActionEvents('scan.scan', ['u1', 'bot-1'], {}, at)).toEqual([])
  })
})
