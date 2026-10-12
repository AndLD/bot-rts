import { BotCapacity, NO_CAPACITY } from '../domain/bot-capacity'

// The processor capacity of every bot with a running execution, kept up to date by the engine as it reads the bots
export class BotCapacities {
  private readonly byBot = new Map<string, BotCapacity>()

  set(botId: string, capacity: BotCapacity): void {
    this.byBot.set(botId, capacity)
  }

  get(botId: string): BotCapacity {
    return this.byBot.get(botId) ?? NO_CAPACITY
  }

  forget(botId: string): void {
    this.byBot.delete(botId)
  }
}
