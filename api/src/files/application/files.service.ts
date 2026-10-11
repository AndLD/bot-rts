import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { BotsService } from '../../bots/application/bots.service'
import { DriveModule } from '../../modules/domain/game-module'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { driveNames } from '../domain/drive'
import { File } from '../domain/file.entity'
import { AlreadyExistsError, DriveBrokenError, DriveFullError } from '../domain/file.errors'
import { isDirectChild, parentOf, parsePath } from '../domain/file-path'
import { FileRepository } from './file.repository'

export interface DriveInfo {
  readonly id: string
  readonly botId: string
  readonly name: string
  readonly quota: number
  readonly used: number
}

// The files of a bot: each memory module is a drive with a byte quota (design §11.4)
export class FilesService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bots: BotsService,
    private readonly files: FileRepository,
    private readonly ids: IdGenerator,
    private readonly registry: ModuleRegistry
  ) {}

  // The memory modules of an own bot, working or not
  async listDrives(userId: string, botId: string): Promise<DriveInfo[]> {
    await this.bots.getOwnedBot(userId, botId)
    return this.unitOfWork.run(async ({ modules, files }) => {
      const drives = this.registry.instancesOf(await modules.listOfBot(botId), DriveModule)
      const names = driveNames(drives)
      return Promise.all(
        drives.map(async (drive) => ({
          id: drive.id,
          botId,
          name: names.get(drive.id) as string,
          quota: drive.quota,
          used: await files.usedBytes(drive.id)
        }))
      )
    })
  }

  // The entries directly inside a directory (the root when none is given)
  async list(userId: string, botId: string, driveId: string, directory?: string): Promise<File[]> {
    return this.withDrive(userId, botId, driveId, async (files) => {
      const folder = directory ? parsePath(directory, FILE_KIND.DIRECTORY) : null
      if (folder) {
        await this.requireDirectory(files, driveId, folder)
      }
      return (await files.listOfDrive(driveId)).filter((file) => isDirectChild(file.path, folder))
    })
  }

  async read(userId: string, botId: string, driveId: string, path: string): Promise<File> {
    return this.withDrive(userId, botId, driveId, async (files) => {
      const file = await files.findByPath(driveId, parsePath(path, FILE_KIND.FILE))
      if (!file || file.kind !== FILE_KIND.FILE) {
        throw new NotFoundError('File not found')
      }
      return file
    })
  }

  // Creates the file or replaces its content, as long as the drive has room for it
  async write(userId: string, botId: string, driveId: string, path: string, content: string): Promise<File> {
    return this.withDrive(userId, botId, driveId, async (files, drive) => {
      const normalised = parsePath(path, FILE_KIND.FILE)
      await this.requireParent(files, driveId, normalised)

      const existing = await files.findByPath(driveId, normalised)
      if (existing && existing.kind !== FILE_KIND.FILE) {
        throw new AlreadyExistsError('A directory with this name')
      }

      const size = Buffer.byteLength(content, 'utf8')
      const used = (await files.usedBytes(driveId)) - (existing?.size ?? 0)
      if (used + size > drive.quota) {
        throw new DriveFullError()
      }

      const file: File = {
        id: existing?.id ?? this.ids.next(),
        driveId,
        path: normalised,
        kind: FILE_KIND.FILE,
        content,
        size
      }
      await files.save(file)
      return file
    })
  }

  async makeDirectory(userId: string, botId: string, driveId: string, path: string): Promise<File> {
    return this.withDrive(userId, botId, driveId, async (files) => {
      const normalised = parsePath(path, FILE_KIND.DIRECTORY)
      await this.requireParent(files, driveId, normalised)
      if (await files.findByPath(driveId, normalised)) {
        throw new AlreadyExistsError('The path')
      }

      const directory: File = {
        id: this.ids.next(),
        driveId,
        path: normalised,
        kind: FILE_KIND.DIRECTORY,
        content: '',
        size: 0
      }
      await files.save(directory)
      return directory
    })
  }

  // Deletes a file, or a directory when it is empty
  async remove(userId: string, botId: string, driveId: string, path: string): Promise<void> {
    await this.withDrive(userId, botId, driveId, async (files) => {
      const normalised = parsePath(path, FILE_KIND.DIRECTORY)
      const target = await files.findByPath(driveId, normalised)
      if (!target) {
        throw new NotFoundError('File not found')
      }
      if (target.kind === FILE_KIND.DIRECTORY) {
        const entries = await files.listOfDrive(driveId)
        if (entries.some((entry) => isDirectChild(entry.path, normalised))) {
          throw new ValidationError('The directory is not empty')
        }
      }
      await files.remove(target.id)
    })
  }

  // Runs `work` on the drive of an own bot, in one transaction; a broken drive is closed to everyone
  private withDrive<T>(
    userId: string,
    botId: string,
    driveId: string,
    work: (files: FileRepository, drive: DriveModule) => Promise<T>
  ): Promise<T> {
    return this.bots.getOwnedBot(userId, botId).then(() =>
      this.unitOfWork.run(async ({ modules, files }) => {
        const drive = this.registry
          .instancesOf(await modules.listOfBot(botId), DriveModule)
          .find((d) => d.id === driveId)
        if (!drive) {
          throw new NotFoundError('Drive not found')
        }
        if (!drive.isWorking) {
          throw new DriveBrokenError()
        }
        return work(files, drive)
      })
    )
  }

  private async requireParent(files: FileRepository, driveId: string, path: string) {
    const parent = parentOf(path)
    if (parent) {
      await this.requireDirectory(files, driveId, parent)
    }
  }

  private async requireDirectory(files: FileRepository, driveId: string, path: string) {
    const directory = await files.findByPath(driveId, path)
    if (!directory || directory.kind !== FILE_KIND.DIRECTORY) {
      throw new NotFoundError('Directory not found')
    }
  }
}
