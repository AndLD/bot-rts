import { SPAWN_SEED_PATTERN } from '../../../../lib/utils/validation'
import { ValidationError } from '../../shared/domain/errors'
import { Location } from '../../map/domain/map-point.entity'

// A code that lets several players start near each other (design §22.3). The first deploy with a code sets the anchor.
export interface SpawnSeed {
  readonly code: string
  readonly anchor: Location
  readonly createdAt: Date
}

// The player of a seed and the base they started with; one row per player, replaced when they redeploy
export interface SpawnSeedMember {
  readonly seedCode: string
  readonly userId: string
  readonly baseId: string
}

// Codes are not case sensitive
export function normalizeSeedCode(input: string): string {
  const code = input.trim().toUpperCase()
  if (!SPAWN_SEED_PATTERN.test(code)) {
    throw new ValidationError('The spawn seed has 3-24 letters, digits or dashes')
  }
  return code
}
