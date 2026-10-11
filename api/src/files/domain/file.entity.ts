import { FILE_KIND } from '../../../../lib/utils/interfaces/files'

export interface File {
  readonly id: string
  readonly driveId: string
  // Slash-separated path from the root of the drive
  readonly path: string
  readonly kind: FILE_KIND
  readonly content: string
  // Bytes of the content (UTF-8)
  readonly size: number
}
