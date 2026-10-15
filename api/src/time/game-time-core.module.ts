import { Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { CLOCK, Clock } from '../shared/application/clock'
import { GAME_TIME, GameTimeState } from '../shared/application/game-clock'
import { LOGGER, Logger } from '../shared/application/logger'
import { GAME_TIME_STORE, GameTimeSettingsService, GameTimeStore } from './application/game-time-settings.service'
import { PrismaGameTimeStore } from './infrastructure/prisma-game-time.store'

// How often a process reads the settings of the game's time again (a change also reaches it at once through the engine link and the
// socket event)
export const GAME_TIME_POLL_MS = 1000

// The settings of the game's time and their store, without any HTTP: the API app and the engine thread both import it. A process reads
// the settings when it starts and follows the store afterwards.
@Module({
  providers: [
    { provide: GAME_TIME_STORE, inject: [PRISMA_CLIENT], useFactory: (c: PrismaClient) => new PrismaGameTimeStore(c) },
    {
      provide: GameTimeSettingsService,
      inject: [GAME_TIME_STORE, GAME_TIME, CLOCK, LOGGER],
      useFactory: (store: GameTimeStore, state: GameTimeState, clock: Clock, logger: Logger) =>
        new GameTimeSettingsService(store, state, clock, logger)
    }
  ],
  exports: [GameTimeSettingsService]
})
export class GameTimeCoreModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null

  constructor(@Inject(GameTimeSettingsService) private readonly settings: GameTimeSettingsService) {}

  // The first read comes with the first poll, a second after the start, so that creating the application never needs the database
  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.settings.refresh(), GAME_TIME_POLL_MS)
    this.timer.unref()
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
}
