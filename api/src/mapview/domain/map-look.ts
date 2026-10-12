import { MapChassis, MapModuleIcon } from '../../../../lib/utils/interfaces/map'
import { Module } from '../../modules/domain/module.entity'

type Part = Pick<Module, 'type' | 'name' | 'condition' | 'maxCondition'>

// A module below this share of its maximum condition shows as damaged (design §8.4.1)
export const DAMAGED_BELOW = 0.5

const ICONS: Partial<Record<Module['type'], MapModuleIcon>> = {
  weapon: 'weapon',
  mining: 'drill',
  scanner: 'scanner',
  wirelessAdapter: 'antenna'
}
const ICON_ORDER: readonly MapModuleIcon[] = ['weapon', 'drill', 'scanner', 'antenna']

// What the bot rolls on: tracks, wheels, or nothing
export function chassisOf(modules: readonly Part[]): MapChassis {
  const movement = modules.find((module) => module.type === 'movement')

  if (!movement) {
    return 'immobile'
  }

  return movement.name.includes('track') ? 'tracks' : 'wheels'
}

// The icons for its key modules, in a fixed order
export function iconsOf(modules: readonly Part[]): MapModuleIcon[] {
  const present = new Set(modules.map((module) => ICONS[module.type]))

  return ICON_ORDER.filter((icon) => present.has(icon))
}

export const isDamaged = (modules: readonly Part[]) =>
  modules.some((module) => module.condition < module.maxCondition * DAMAGED_BELOW)
