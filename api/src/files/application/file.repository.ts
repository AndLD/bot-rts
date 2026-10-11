import { File } from '../domain/file.entity'

export const FILE_REPOSITORY = Symbol('FileRepository')

export interface FileRepository {
  // Inserts the file, or replaces the content of the file with the same id
  save(file: File): Promise<void>
  remove(id: string): Promise<void>
  findByPath(driveId: string, path: string): Promise<File | null>
  // Every file and directory of the drive, ordered by path
  listOfDrive(driveId: string): Promise<File[]>
  // Total bytes of the drive's files
  usedBytes(driveId: string): Promise<number>
}
