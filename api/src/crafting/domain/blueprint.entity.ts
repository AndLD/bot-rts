import { IBlueprint } from '../../../../lib/utils/interfaces/crafting'

// A blueprint a player learned and when; the base set is known without a record
export interface Blueprint extends IBlueprint {
  readonly learnedAt: Date
}
