import { ModuleType } from '@lib/utils/interfaces/modules'
import { useTranslations } from 'next-intl'

// The family each module type is shown as: the name of the part the player knows (a `mining` module is a drill)
const FAMILY: Record<ModuleType, string> = {
  engine: 'engine',
  movement: 'wheels',
  weapon: 'gun',
  mining: 'drill',
  manipulator: 'manipulator',
  drive: 'memory',
  processor: 'processor',
  wirelessAdapter: 'wireless-adapter',
  battery: 'battery',
  storage: 'storage',
  armor: 'armor',
  scanner: 'scanner',
  generator: 'generator',
  factory: 'factory',
  gps: 'gps',
  repair: 'repair'
}

// A module type in the player's language
export function useModuleTypeName() {
  const t = useTranslations('modules')

  return (type: string) => {
    const family = FAMILY[type as ModuleType]

    return family && t.has(`types.${family}`) ? t(`types.${family}`) : type
  }
}
