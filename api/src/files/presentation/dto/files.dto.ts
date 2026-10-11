import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

// A drive holds a few dozen kilobytes (design §11.4); this only stops absurd request bodies early
const MAX_CONTENT_LENGTH = 1_000_000
const MAX_PATH_LENGTH = 600

export class FilePathQueryDto {
  @IsString()
  @MaxLength(MAX_PATH_LENGTH)
  @ApiProperty()
  path!: string
}

export class ListFilesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PATH_LENGTH)
  @ApiPropertyOptional()
  directory?: string
}

export class WriteFileDto {
  @IsString()
  @MaxLength(MAX_PATH_LENGTH)
  @ApiProperty()
  path!: string

  @IsString()
  @MaxLength(MAX_CONTENT_LENGTH)
  @ApiProperty()
  content!: string
}

export class MakeDirectoryDto {
  @IsString()
  @MaxLength(MAX_PATH_LENGTH)
  @ApiProperty()
  path!: string
}
