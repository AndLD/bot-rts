import { Module } from '../domain/module.entity'
import { unwrap } from '../../shared/domain/result'
import { EnergyEvent, EnergyModel } from '../domain/energy-model'
import { ModuleRepository } from './module.repository'

// Energy accounting of a bot (design §12.5) over its stored modules
export class EnergyService {
  constructor(
    private readonly modules: ModuleRepository,
    private readonly model: EnergyModel
  ) {}

  // Takes the cost of an operation out of the bot's batteries; NO_ENERGY when they cannot pay
  async pay(botId: string, amount: number): Promise<void> {
    const records = await this.modules.listOfBot(botId)
    const changed = unwrap(this.model.spend(records, amount)).filter((record) => !records.includes(record))
    await this.save(changed)
  }

  // One game tick of the bot: idle drain, generators and live scanners. Returns what the bot should be told.
  async tick(botId: string, now: number, ticks = 1): Promise<EnergyEvent[]> {
    const { modules, events } = this.model.tick(await this.modules.listOfBot(botId), now, ticks)
    await this.save(modules)
    return events
  }

  private async save(changed: Module[]): Promise<void> {
    await this.modules.updateMany(changed)
  }
}
