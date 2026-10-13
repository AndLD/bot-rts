import { chassisOf, iconsOf, isDamaged } from './map-look'

const part = (type: string, name = type, condition = 100) =>
  ({ type, name, condition, maxCondition: 100 }) as Parameters<typeof chassisOf>[0][number]

describe('map look', () => {
  it('tells the chassis from the movement module', () => {
    expect(chassisOf([])).toBe('immobile')
    expect(chassisOf([part('movement', 'wheels-class1')])).toBe('wheels')
    expect(chassisOf([part('movement', 'tracks-class2')])).toBe('tracks')
  })

  it('lists the icons of key modules once, in a fixed order', () => {
    expect(iconsOf([part('wirelessAdapter'), part('weapon'), part('weapon'), part('battery'), part('mining')])).toEqual(
      ['weapon', 'drill', 'antenna']
    )
    expect(iconsOf([part('solarPanel'), part('scanner')])).toEqual(['scanner', 'solar'])
    expect(iconsOf([])).toEqual([])
  })

  it('calls a bot damaged when a module is below half its condition', () => {
    expect(isDamaged([part('weapon', 'w', 100), part('engine', 'e', 50)])).toBe(false)
    expect(isDamaged([part('weapon', 'w', 100), part('engine', 'e', 49)])).toBe(true)
    expect(isDamaged([])).toBe(false)
  })
})
