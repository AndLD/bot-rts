import { FilesService } from '../../files/application/files.service'
import { splitDrivePath } from '../../files/domain/drive'
import { NotFoundError } from '../../shared/domain/errors'
import { ScriptSource } from '../application/engine-ports'

// Reads a script from the drives of its bot, addressed as `/<drive>/<path>`
export class FilesScriptSource implements ScriptSource {
  constructor(private readonly files: FilesService) {}

  async read(userId: string, botId: string, path: string): Promise<string> {
    const target = splitDrivePath(await this.files.listDrives(userId, botId), path)
    if (!target) {
      throw new NotFoundError('File not found')
    }
    return (await this.files.read(userId, botId, target.drive.id, target.path)).content
  }
}
