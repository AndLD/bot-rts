import { Prisma } from '@prisma/client'
import { FileRepository } from '../application/file.repository'
import { File } from '../domain/file.entity'

export class PrismaFileRepository implements FileRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async add(file: File): Promise<void> {
    await this.db.file.create({ data: file })
  }

  async listOfDrive(driveId: string): Promise<File[]> {
    return await this.db.file.findMany({ where: { driveId }, orderBy: { name: 'asc' } })
  }

  async findByName(driveId: string, name: string): Promise<File | null> {
    return await this.db.file.findUnique({ where: { driveId_name: { driveId, name } } })
  }
}
