import { ok } from '../../../../../lib/utils/result'
import { FilesService } from '../../../files/application/files.service'
import { splitDrivePath } from '../../../files/domain/drive'
import { NotFoundError } from '../../../shared/domain/errors'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// read and write: the files on the bot's drives, addressed as `/<drive>/<path>` (design §11.4)
export class DriveHandler implements ScriptFunctionHandler {
  readonly functions = ['read', 'write']

  constructor(private readonly files: FilesService) {}

  async handle({ bot, ownerId }: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const target = splitDrivePath(await this.files.listDrives(ownerId, bot.id), args[0] as string)
    if (!target) {
      throw new NotFoundError('Unknown path')
    }
    if (fn === 'read') {
      const file = await this.files.read(ownerId, bot.id, target.drive.id, target.path)
      return ok({ path: args[0] as string, content: file.content, size: file.size })
    }
    const file = await this.files.write(ownerId, bot.id, target.drive.id, target.path, args[1] as string)
    return ok({ path: args[0] as string, size: file.size })
  }
}
