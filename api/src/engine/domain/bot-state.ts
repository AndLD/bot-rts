import { Bot } from '../../bots/domain/bot.entity'
import { Module } from '../../modules/domain/module.entity'

// A bot as the engine holds it while one of its scripts runs: who it is, who owns it and what it is made of
export interface BotState {
  readonly bot: Bot
  // The player the bot belongs to (the owner of its base)
  readonly ownerId: string
  readonly modules: readonly Module[]
}
