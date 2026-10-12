import { ModuleType } from '@lib/utils/interfaces/modules'
import { findScriptFunction } from '@lib/utils/script-api'
import { actionGroups, buildArgs } from './actionForm'

const spec = (name: string) => findScriptFunction(name) as NonNullable<ReturnType<typeof findScriptFunction>>

describe('buildArgs', () => {
  it('turns what was typed into the arguments of the call', () => {
    expect(buildArgs(spec('move'), { cells: '3' })).toEqual({ ok: true, args: [3] })
    expect(buildArgs(spec('shoot'), { x: ' 4 ', y: '-5' })).toEqual({ ok: true, args: [4, -5] })
    expect(buildArgs(spec('turn'), { direction: 'left' })).toEqual({ ok: true, args: ['left'] })
    expect(buildArgs(spec('scan'), {})).toEqual({ ok: true, args: [] })
  })

  it('leaves out an optional argument that was not typed, from the end', () => {
    expect(buildArgs(spec('drop'), {})).toEqual({ ok: true, args: [] })
    expect(buildArgs(spec('drop'), { x: '1', y: '2' })).toEqual({ ok: true, args: [1, 2] })
    expect(buildArgs(spec('craft'), { module: 'gun-class1' })).toEqual({ ok: true, args: ['gun-class1'] })
    expect(buildArgs(spec('craft'), { module: 'gun-class1', count: '2' })).toEqual({
      ok: true,
      args: ['gun-class1', 2]
    })
  })

  it('splits a list, and passes null for an empty name that may be null', () => {
    expect(buildArgs(spec('assemble'), { label: 'Scout', partIds: 'a, b  c' })).toEqual({
      ok: true,
      args: ['Scout', ['a', 'b', 'c']]
    })
    expect(buildArgs(spec('assemble'), { partIds: 'a' })).toEqual({ ok: true, args: [null, ['a']] })
  })

  it('names the argument that is missing or not a number', () => {
    expect(buildArgs(spec('move'), {})).toEqual({ ok: false, arg: 'cells', reason: 'missing' })
    expect(buildArgs(spec('move'), { cells: '  ' })).toEqual({ ok: false, arg: 'cells', reason: 'missing' })
    expect(buildArgs(spec('move'), { cells: '1.5' })).toEqual({ ok: false, arg: 'cells', reason: 'invalid' })
    expect(buildArgs(spec('move'), { cells: 'many' })).toEqual({ ok: false, arg: 'cells', reason: 'invalid' })
    expect(buildArgs(spec('assemble'), { label: 'x' })).toEqual({ ok: false, arg: 'partIds', reason: 'missing' })
  })
})

describe('actionGroups', () => {
  const groupsFor = (...types: ModuleType[]) => actionGroups(new Set(types))
  const names = (...types: ModuleType[]) => groupsFor(...types).map((g) => [g.category, g.actions.map((a) => a.name)])

  it('offers observation first and only what the modules grant, by category', () => {
    expect(names('scanner', 'engine', 'movement', 'weapon')).toEqual([
      [null, ['scan', 'view']],
      ['movement', ['move', 'turn']],
      ['combat', ['aim', 'shoot', 'reload']],
      ['maintenance', ['enable', 'disable']]
    ])
  })

  it('leaves out a category the bot has nothing for, and what is not done by hand', () => {
    expect(names()).toEqual([])
    const all = groupsFor('manipulator', 'mining', 'repair', 'factory', 'drive', 'gps').flatMap((g) =>
      g.actions.map((a) => a.name)
    )
    expect(all).not.toContain('sleep')
    expect(all).toEqual(expect.arrayContaining(['dig', 'pick', 'drop', 'repair', 'craft', 'read', 'getLocation']))
  })
})
