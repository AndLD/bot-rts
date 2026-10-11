import { File } from '../domain/file.entity'

export const FILE_REPOSITORY = Symbol('FileRepository')

export interface FileRepository {
  add(file: File): Promise<void>
  listOfDrive(driveId: string): Promise<File[]>
  findByName(driveId: string, name: string): Promise<File | null>
}
