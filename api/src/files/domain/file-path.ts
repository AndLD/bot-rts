import { FILE_EXTENSIONS, FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { ValidationError } from '../../shared/domain/errors'

export const MAX_SEGMENT_LENGTH = 64
export const MAX_PATH_DEPTH = 8

const SEGMENT_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

// Checks a path and returns it normalised (no surrounding or doubled slashes). A file needs one of the allowed
// extensions (design §11.4); a directory may have any name that is valid as a segment.
export function parsePath(input: string, kind: FILE_KIND): string {
  const segments = input.split('/').filter((segment) => segment !== '')

  if (!segments.length) {
    throw new ValidationError('The path is empty')
  }
  if (segments.length > MAX_PATH_DEPTH) {
    throw new ValidationError(`The path is deeper than ${MAX_PATH_DEPTH} levels`)
  }
  for (const segment of segments) {
    if (segment.length > MAX_SEGMENT_LENGTH || segment === '.' || segment === '..' || !SEGMENT_PATTERN.test(segment)) {
      throw new ValidationError(`Invalid name: ${segment.slice(0, MAX_SEGMENT_LENGTH)}`)
    }
  }

  const name = segments[segments.length - 1]
  if (kind === FILE_KIND.FILE && !FILE_EXTENSIONS.some((extension) => name.endsWith(extension) && name !== extension)) {
    throw new ValidationError(`A file must end with ${FILE_EXTENSIONS.join(', ')}`)
  }
  return segments.join('/')
}

export function parentOf(path: string): string | null {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? null : path.slice(0, cut)
}

// The entry names directly inside `directory` (null is the root) given the paths on the drive
export function isDirectChild(path: string, directory: string | null): boolean {
  return parentOf(path) === directory
}
