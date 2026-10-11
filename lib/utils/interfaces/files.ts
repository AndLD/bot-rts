import { ID } from '../types'

export enum FILE_KIND {
  FILE = 'file',
  DIRECTORY = 'directory'
}

// What a drive may hold (design §11.4)
export const FILE_EXTENSIONS = ['.js', '.ts', '.json', '.txt'] as const

export interface IFile {
  _id: ID
  driveId: ID
  // Slash-separated path from the root of the drive, e.g. `scripts/mine.js`
  path: string
  kind: FILE_KIND
  // bytes; a directory has none
  size: number
  // Only when the file is read, not in listings
  content?: string
}

// A memory module seen as a disk: its quota and what is used of it, in bytes
export interface IDrive {
  _id: ID
  botId: ID
  // Unique among the drives of a bot; this is what `cd` takes
  name: string
  quota: number
  used: number
}
