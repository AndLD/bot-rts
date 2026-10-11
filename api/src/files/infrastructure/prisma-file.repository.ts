import { File as FileRow, Prisma } from '@prisma/client'
import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { FileRepository } from '../application/file.repository'
import { File } from '../domain/file.entity'

const toEntity = (row: FileRow): File => ({ ...row, kind: row.kind as FILE_KIND })

export class PrismaFileRepository implements FileRepository {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async save(file: File): Promise<void> {
    await this.db.file.upsert({
      where: { id: file.id },
      create: file,
      update: { content: file.content, size: file.size }
    })
  }

  async remove(id: string): Promise<void> {
    await this.db.file.delete({ where: { id } })
  }

  async findByPath(driveId: string, path: string): Promise<File | null> {
    const row = await this.db.file.findUnique({ where: { driveId_path: { driveId, path } } })
    return row && toEntity(row)
  }

  async listOfDrive(driveId: string): Promise<File[]> {
    const rows = await this.db.file.findMany({ where: { driveId }, orderBy: { path: 'asc' } })
    return rows.map(toEntity)
  }

  async usedBytes(driveId: string): Promise<number> {
    const { _sum } = await this.db.file.aggregate({ where: { driveId }, _sum: { size: true } })
    return _sum.size ?? 0
  }
}
