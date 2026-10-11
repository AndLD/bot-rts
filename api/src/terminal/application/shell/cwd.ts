import { DriveInfo } from '../../../files/application/files.service'
import { NotFoundError } from '../../../shared/domain/errors'

// Where a session is: a drive (by id) and the directory on it, both null at the top, which lists the drives
export interface Cwd {
  readonly driveId: string | null
  readonly directory: string | null
}

export const TOP: Cwd = { driveId: null, directory: null }

// Follows a `cd`-style path from the current place (or from the top when it starts with a slash). Whether the
// directory exists is for the caller to check.
export function resolvePlace(cwd: Cwd, drives: readonly DriveInfo[], target: string): Cwd {
  let drive = target.startsWith('/') ? null : (drives.find((candidate) => candidate.id === cwd.driveId) ?? null)
  const directory = drive && cwd.directory ? cwd.directory.split('/') : []

  for (const segment of target.split('/').filter((part) => part !== '' && part !== '.')) {
    if (segment === '..') {
      if (directory.length) {
        directory.pop()
      } else {
        drive = null
      }
    } else if (!drive) {
      drive = drives.find((candidate) => candidate.name === segment) ?? null
      if (!drive) {
        throw new NotFoundError('Unknown path')
      }
    } else {
      directory.push(segment)
    }
  }

  return { driveId: drive?.id ?? null, directory: directory.join('/') || null }
}

// The path of an argument on the drive: relative to the current directory unless it starts with a slash
export function pathOnDrive(cwd: Cwd, argument: string): string {
  return argument.startsWith('/') ? argument : [cwd.directory, argument].filter(Boolean).join('/')
}
