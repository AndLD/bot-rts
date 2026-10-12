import { BotState } from '../domain/bot-state'
import { ExecutionView } from '../domain/execution'

export const BOT_STATE_SOURCE = Symbol('BotStateSource')
export const SCRIPT_SOURCE = Symbol('ScriptSource')

// Where the engine learns what a bot is made of
export interface BotStateSource {
  // The bot with its modules and owner, or null when it does not exist (any more)
  load(botId: string): Promise<BotState | null>
  // The bot of this player, provided the player controls it (design §6.3); throws the use cases' errors otherwise
  loadControlled(userId: string, botId: string): Promise<BotState>
}

// Where the engine reads the source of a script file
export interface ScriptSource {
  // Throws NotFoundError when the path names no file the bot's drives hold
  read(userId: string, botId: string, path: string): Promise<string>
}

// What the engine tells the outside world as it works (design §11.2.3, §24)
export type EngineEvent =
  | {
      type: 'log'
      executionId: string
      botId: string
      userId: string
      kind: 'output' | 'error' | 'system'
      text: string
    }
  | { type: 'execution'; userId: string; execution: ExecutionView }

export interface EngineSink {
  emit(event: EngineEvent): void
}
