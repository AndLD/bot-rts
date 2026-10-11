import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { pickResource, rollDepositAmount, validateResourceBalance } from './resource-balance'

describe('pickResource', () => {
  it('follows the spawn weights in order', () => {
    // weights 30 / 25 / 20 / 12 / 9 / 4 = 100
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0)).toBe(RESOURCE.IRON)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.299)).toBe(RESOURCE.IRON)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.3)).toBe(RESOURCE.STONE)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.55)).toBe(RESOURCE.WOOD)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.75)).toBe(RESOURCE.OIL)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.87)).toBe(RESOURCE.CRYSTAL)
    expect(pickResource(DEFAULT_RESOURCE_BALANCE, 0.97)).toBe(RESOURCE.GOLD)
  })

  it('never picks a resource with weight zero and tolerates a roll of exactly 1', () => {
    const onlyGold = Object.fromEntries(
      Object.entries(DEFAULT_RESOURCE_BALANCE).map(([resource, balance]) => [
        resource,
        { ...balance, spawnWeight: resource === RESOURCE.GOLD ? 1 : 0 }
      ])
    ) as typeof DEFAULT_RESOURCE_BALANCE

    expect(pickResource(onlyGold, 0)).toBe(RESOURCE.GOLD)
    expect(pickResource(onlyGold, 1)).toBe(RESOURCE.GOLD)
  })
})

describe('rollDepositAmount', () => {
  const range = { spawnWeight: 1, minAmount: 10, maxAmount: 12, hardness: 1 }

  it('covers the range inclusively', () => {
    expect(rollDepositAmount(range, 0)).toBe(10)
    expect(rollDepositAmount(range, 0.5)).toBe(11)
    expect(rollDepositAmount(range, 0.999)).toBe(12)
  })
})

describe('validateResourceBalance', () => {
  it('accepts the defaults', () => {
    expect(validateResourceBalance(DEFAULT_RESOURCE_BALANCE)).toEqual([])
  })

  it('reports negative or non-finite numbers and inverted ranges', () => {
    const iron = DEFAULT_RESOURCE_BALANCE[RESOURCE.IRON]
    expect(validateResourceBalance({ ...DEFAULT_RESOURCE_BALANCE, iron: { ...iron, spawnWeight: -1 } })).toEqual([
      'iron: every number must be zero or positive'
    ])
    expect(
      validateResourceBalance({ ...DEFAULT_RESOURCE_BALANCE, iron: { ...iron, hardness: Number.NaN } })
    ).toHaveLength(1)
    expect(
      validateResourceBalance({ ...DEFAULT_RESOURCE_BALANCE, iron: { ...iron, minAmount: 9, maxAmount: 3 } })
    ).toEqual(['iron: minAmount must not exceed maxAmount'])
  })

  it('needs a resource that can spawn', () => {
    const none = Object.fromEntries(
      Object.entries(DEFAULT_RESOURCE_BALANCE).map(([resource, balance]) => [resource, { ...balance, spawnWeight: 0 }])
    ) as typeof DEFAULT_RESOURCE_BALANCE

    expect(validateResourceBalance(none)).toEqual(['at least one resource needs a spawn weight above zero'])
  })
})
