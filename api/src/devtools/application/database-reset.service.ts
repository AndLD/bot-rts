import { IResetDatabaseResult, RESET_CONFIRMATION } from '../../../../lib/utils/admin-devtools'
import { DEFAULT_GAME_TIME_SETTINGS } from '../../../../lib/utils/game-time'
import { Logger } from '../../shared/application/logger'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { GameTimeSettingsService } from '../../time/application/game-time-settings.service'
import { DatabaseResetter, EngineRestarter, ResetKeep } from './ports'

// Puts a test server back to an empty world (design §25.3, Dev tools): the engine is stopped so that it writes nothing more, the tables of
// the game are emptied, the engine starts again on the empty world, and the game clock goes back to real time. The owners and the admin
// who pressed the button stay, with their logins; every other login ends; the audit log and the migrations are never touched.
export class DatabaseResetService {
  constructor(
    private readonly resetter: DatabaseResetter,
    // Null when the engine does not run in this process (switched off, or on another node, which a reset cannot stop)
    private readonly engine: EngineRestarter | null,
    private readonly isEngineEnabled: boolean,
    private readonly gameTime: GameTimeSettingsService,
    private readonly logger: Logger
  ) {}

  async reset(keep: ResetKeep, confirmation: string): Promise<IResetDatabaseResult> {
    if (confirmation !== RESET_CONFIRMATION) {
      throw new ValidationError(`Type ${RESET_CONFIRMATION} to reset the database`)
    }
    if (this.isEngineEnabled && !this.engine) {
      throw new ForbiddenError('The reset needs the engine in this process: run it on the node that runs the engine')
    }
    await this.engine?.stop()
    let result: { tablesEmptied: number; accountsErased: number }

    try {
      result = await this.resetter.wipe(keep)
    } finally {
      // The engine comes back on whatever the database holds, so that a failed wipe does not leave the server without it
      await this.engine?.start()
    }
    // Back to real time, and told to the engine and to every connected client
    await this.gameTime.update(DEFAULT_GAME_TIME_SETTINGS, { isResetOfOffset: true })
    this.logger.info(
      `The database was reset: ${result.tablesEmptied} tables emptied, ${result.accountsErased} accounts erased`
    )

    return result
  }
}
