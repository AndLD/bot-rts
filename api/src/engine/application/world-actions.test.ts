import { controlledBotOf, WORLD_ACTION_NAMES, WorldActionName } from './world-actions'

describe('controlledBotOf', () => {
  it('finds the bot a manual action takes control of', () => {
    expect(controlledBotOf('scan.scan', ['u', 'b'])).toEqual({ userId: 'u', botId: 'b' })
    expect(controlledBotOf('factory.craft', ['u', 'base', 'scanner-class1'])).toEqual({ userId: 'u', botId: 'base' })
    expect(controlledBotOf('factory.research', ['u', 'base', 'm'])).toEqual({ userId: 'u', botId: 'base' })
    expect(controlledBotOf('factory.learn', ['u', 'base', 'i'])).toEqual({ userId: 'u', botId: 'base' })
    expect(controlledBotOf('assembly.assemble', ['u', { baseId: 'base', label: null, partIds: [] }])).toEqual({
      userId: 'u',
      botId: 'base'
    })
    expect(controlledBotOf('maintenance.repair', ['u', { repairerId: 'r', targetBotId: 't', moduleId: 'm' }])).toEqual({
      userId: 'u',
      botId: 'r'
    })
    expect(controlledBotOf('maintenance.disassemble', ['u', { repairerId: 'r' }])).toEqual({ userId: 'u', botId: 'r' })
    expect(controlledBotOf('files.write', ['u', 'b', 'd', 'a.js', 'x'])).toEqual({ userId: 'u', botId: 'b' })
    expect(controlledBotOf('access.connect', ['u', 'from', 'target', 'pw'])).toEqual({ userId: 'u', botId: 'from' })
    expect(controlledBotOf('access.adopt', ['u', 'from', 'target'])).toEqual({ userId: 'u', botId: 'from' })
    expect(controlledBotOf('files.makeDirectory', ['u', 'b', 'd', 'lib'])).toEqual({ userId: 'u', botId: 'b' })
    expect(controlledBotOf('files.remove', ['u', 'b', 'd', 'a.js'])).toEqual({ userId: 'u', botId: 'b' })
  })

  it('names no bot for deploying a base', () => {
    expect(controlledBotOf('bots.deployUserBase', [{ id: 'u', name: 'U' }, { password: 'x' }])).toBeNull()
  })

  it('answers for every action', () => {
    const names = Object.keys(WORLD_ACTION_NAMES) as WorldActionName[]

    expect(names.length).toBeGreaterThan(5)
    for (const name of names) {
      expect(() => controlledBotOf(name, ['u', { baseId: 'b', repairerId: 'r' }])).not.toThrow()
    }
  })
})
