import { IEconomyOverview } from '../../../../lib/utils/admin-balance'
import { RESOURCES, ResourceBalance } from '../../../../lib/utils/interfaces/resources'
import { EconomyReadModel } from './ports'

// The resources of the world and the production around them (design §25.3, Economy and balance): what is in the deposits and in
// the storages, which blueprints the players learned, and which modules exist
export class EconomyService {
  constructor(
    private readonly readModel: EconomyReadModel,
    private readonly resources: ResourceBalance
  ) {}

  async overview(): Promise<IEconomyOverview> {
    const [deposits, stored, blueprints, modules] = await Promise.all([
      this.readModel.deposits(),
      this.readModel.stored(),
      this.readModel.blueprints(),
      this.readModel.modules()
    ])
    const byModule = new Map<string, { module: string; research: number; item: number }>()

    for (const { module, source, players } of blueprints) {
      const row = byModule.get(module) ?? { module, research: 0, item: 0 }
      byModule.set(module, { ...row, [source === 'research' ? 'research' : 'item']: players })
    }

    return {
      resources: RESOURCES.map((resource) => {
        const found = deposits.find((deposit) => deposit.resource === resource)

        return {
          resource,
          deposits: found?.deposits ?? 0,
          depleted: found?.depleted ?? 0,
          remaining: found?.remaining ?? 0,
          // What the deposits held when generated: their number times the largest deposit of the resource, as the map shows it
          capacity: (found?.deposits ?? 0) * this.resources[resource].maxAmount,
          stored: stored.find((stack) => stack.resource === resource)?.amount ?? 0
        }
      }),
      blueprints: [...byModule.values()].sort((a, b) => b.research + b.item - (a.research + a.item)),
      modules: [...modules].sort((a, b) => b.count - a.count)
    }
  }
}
