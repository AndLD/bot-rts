import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { buildModule } from '../../../tests/integration/builders'
import { Module } from './module.entity'
import { depositStacks, stockOf, withdrawStacks } from './storage-stock'

const storage = (items: unknown[], overrides: Partial<Module> = {}) =>
  buildModule('bot', { type: 'storage', props: { capacity: 1000, items }, ...overrides })

describe('stockOf', () => {
  it('adds up a resource over the working storages', () => {
    const records = [
      storage([{ resource: 'iron', amount: 10 }]),
      storage([{ resource: 'iron', amount: 5.5 }]),
      storage([{ resource: 'iron', amount: 99 }], { condition: 0 }),
      buildModule('bot', { type: 'battery', props: {} })
    ]

    expect(stockOf(records, RESOURCE.IRON)).toBe(15.5)
    expect(stockOf(records, RESOURCE.GOLD)).toBe(0)
  })
})

describe('withdrawStacks', () => {
  it('takes the stacks out of the storages in turn and returns only the changed records', () => {
    const first = storage([{ resource: 'iron', amount: 10 }])
    const second = storage([
      { resource: 'iron', amount: 30 },
      { resource: 'oil', amount: 4 }
    ])
    const untouched = storage([{ resource: 'gold', amount: 1 }])

    const result = withdrawStacks(
      [first, second, untouched],
      [
        { resource: RESOURCE.IRON, amount: 25 },
        { resource: RESOURCE.OIL, amount: 4 }
      ]
    )

    expect(result.ok && result.data.map((m) => m.props.items)).toEqual([[], [{ resource: 'iron', amount: 15 }]])
  })

  it('takes nothing and names the resource when one is short', () => {
    const records = [storage([{ resource: 'iron', amount: 10 }])]

    expect(
      withdrawStacks(records, [
        { resource: RESOURCE.IRON, amount: 5 },
        { resource: RESOURCE.GOLD, amount: 1 }
      ])
    ).toEqual({ ok: false, code: 'EMPTY', msg: 'Not enough gold' })
    expect(
      withdrawStacks(
        [storage([{ resource: 'iron', amount: 1 }], { condition: 0 })],
        [{ resource: RESOURCE.IRON, amount: 1 }]
      )
    ).toMatchObject({
      ok: false
    })
  })

  it('succeeds with nothing to take', () => {
    expect(withdrawStacks([storage([])], [])).toEqual({ ok: true, data: [] })
  })
})

describe('depositStacks', () => {
  it('fills the storages in turn and returns only the changed records', () => {
    const first = buildModule('bot', {
      type: 'storage',
      props: { capacity: 10, items: [{ resource: 'iron', amount: 8 }] }
    })
    const second = buildModule('bot', { type: 'storage', props: { capacity: 10, items: [] } })
    const untouched = buildModule('bot', { type: 'storage', props: { capacity: 10, items: [] } })

    const result = depositStacks([first, second, untouched], [{ resource: RESOURCE.IRON, amount: 6 }])

    expect(result.ok && result.data.map((m) => m.props.items)).toEqual([
      [{ resource: 'iron', amount: 10 }],
      [{ resource: 'iron', amount: 4 }]
    ])
  })

  it('refuses what does not fit anywhere, and ignores broken storages and empty stacks', () => {
    const full = buildModule('bot', { type: 'storage', props: { capacity: 5, items: [] } })
    const broken = buildModule('bot', { type: 'storage', condition: 0, props: { capacity: 500, items: [] } })

    expect(depositStacks([full, broken], [{ resource: RESOURCE.IRON, amount: 6 }])).toMatchObject({
      ok: false,
      code: 'NO_SPACE'
    })
    expect(depositStacks([full], [{ resource: RESOURCE.IRON, amount: 0 }])).toEqual({ ok: true, data: [] })
  })
})
