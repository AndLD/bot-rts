import {
  ManualCategory,
  categoryOfFunction,
  effectiveSwitches,
  withDefaults
} from '../../../../lib/utils/interfaces/settings'
import { InMemorySettingsRepository } from '../../../tests/fakes/fakes'
import { SettingsService } from './settings.service'

function setup() {
  const repository = new InMemorySettingsRepository()

  return { repository, service: new SettingsService(repository) }
}

describe('SettingsService', () => {
  it('starts with everything on and motion as the system', async () => {
    const { service } = setup()

    const settings = await service.get('u1')

    expect(Object.values(settings.global.categories).every(Boolean)).toBe(true)
    expect(Object.values(settings.effective).every(Boolean)).toBe(true)
    expect(settings.user.reducedMotion).toBeNull()
  })

  it('lets a player switch categories off for themselves only, and keeps what they switched before', async () => {
    const { service } = setup()

    await service.updateUser('u1', { categories: { combat: false } })
    const settings = await service.updateUser('u1', { categories: { movement: false }, reducedMotion: true })

    expect(settings.user.categories).toMatchObject({ combat: false, movement: false, trade: true })
    expect(settings.user.reducedMotion).toBe(true)
    expect(settings.effective).toMatchObject({ combat: false, movement: false, fabrication: true })
    expect((await service.get('u2')).effective.combat).toBe(true)
  })

  it('keeps the motion setting when it is not mentioned, and lets it go back to the system', async () => {
    const { service } = setup()
    await service.updateUser('u1', { reducedMotion: true })

    expect((await service.updateUser('u1', { categories: { combat: false } })).user.reducedMotion).toBe(true)
    expect((await service.updateUser('u1', { reducedMotion: null })).user.reducedMotion).toBeNull()
  })

  it('makes the game settings a ceiling the player cannot lift', async () => {
    const { service } = setup()
    await service.updateGame({ combat: false })

    const settings = await service.updateUser('u1', { categories: { combat: true } })

    expect(settings.user.categories.combat).toBe(true)
    expect(settings.global.categories.combat).toBe(false)
    expect(settings.effective.combat).toBe(false)
    expect(await service.isAllowed('u1', ManualCategory.COMBAT)).toBe(false)
    expect(await service.isAllowed('u1', ManualCategory.MOVEMENT)).toBe(true)
    expect((await service.getGame()).categories.combat).toBe(false)
  })

  it('answers whether a player may use a category', async () => {
    const { service } = setup()
    await service.updateUser('u1', { categories: { trade: false } })

    expect(await service.isAllowed('u1', ManualCategory.TRADE)).toBe(false)
    expect(await service.isAllowed('u2', ManualCategory.TRADE)).toBe(true)
  })

  it.each([
    ['an unknown category', { categories: { flying: true } }],
    ['a switch that is not a boolean', { categories: { combat: 'no' } }],
    ['a bad motion setting', { reducedMotion: 'yes' as never }]
  ])('refuses %s', async (_name, patch) => {
    await expect(setup().service.updateUser('u1', patch)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses a bad change of the game settings', async () => {
    await expect(setup().service.updateGame({ combat: 1 })).rejects.toMatchObject({ statusCode: 400 })
    await expect(setup().service.updateGame({ flying: false })).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('the switches of manual control', () => {
  it('turn on every category that is not mentioned, so a new one starts on', () => {
    expect(withDefaults(undefined).trade).toBe(true)
    expect(withDefaults(null).combat).toBe(true)
    expect(withDefaults({ combat: false }).combat).toBe(false)
    expect(withDefaults({ combat: false }).movement).toBe(true)
  })

  it('are narrowed by both levels', () => {
    const global = withDefaults({ combat: false })
    const personal = withDefaults({ movement: false })

    expect(effectiveSwitches(global, personal)).toMatchObject({ combat: false, movement: false, trade: true })
  })

  it('name the category of each manual action, and none for observation', () => {
    expect(categoryOfFunction('move')).toBe(ManualCategory.MOVEMENT)
    expect(categoryOfFunction('shoot')).toBe(ManualCategory.COMBAT)
    expect(categoryOfFunction('drop')).toBe(ManualCategory.EXTRACTION)
    expect(categoryOfFunction('craft')).toBe(ManualCategory.FABRICATION)
    expect(categoryOfFunction('repair')).toBe(ManualCategory.MAINTENANCE)
    expect(categoryOfFunction('scan')).toBeNull()
    expect(categoryOfFunction('view')).toBeNull()
    expect(categoryOfFunction('constructor')).toBeNull()
  })
})
