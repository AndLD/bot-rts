import { IDrive, IFile } from '../../../../lib/utils/interfaces/files'
import { DriveInfo } from '../application/files.service'
import { File } from '../domain/file.entity'

// Listings leave the content out; reading a file includes it
export function toFileDto(
  { id, driveId, path, kind, size, content }: File,
  options: { withContent?: boolean } = {}
): IFile {
  const dto: IFile = { _id: id, driveId, path, kind, size }
  if (options.withContent) {
    dto.content = content
  }
  return dto
}

export function toDriveDto({ id, botId, name, quota, used }: DriveInfo): IDrive {
  return { _id: id, botId, name, quota, used }
}
