import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { FILE_KIND, IDrive, IFile } from '../../../../../lib/utils/interfaces/files'

export class FileResponse implements IFile {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ format: 'uuid' })
  driveId!: string

  @ApiProperty({ description: 'Slash-separated path from the root of the drive', example: 'scripts/mine.js' })
  path!: string

  @ApiProperty({ enum: FILE_KIND })
  kind!: FILE_KIND

  @ApiProperty({ description: 'bytes' })
  size!: number

  @ApiPropertyOptional({ description: 'Only when the file is read, not in listings' })
  content?: string
}

export class DriveResponse implements IDrive {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty({ description: 'What `cd` takes; unique among the drives of a bot' })
  name!: string

  @ApiProperty({ description: 'bytes' })
  quota!: number

  @ApiProperty({ description: 'bytes' })
  used!: number
}
