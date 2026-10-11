import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min
} from 'class-validator'
import { MAX_CRAFT_COUNT } from '../../../../../lib/utils/interfaces/crafting'

export const MODULE_NAME_MAX_LENGTH = 64
export const BOT_LABEL_MAX_LENGTH = 64
export const MAX_PARTS_PER_BOT = 50

export class CraftDto {
  @IsString()
  @Length(1, MODULE_NAME_MAX_LENGTH)
  @ApiProperty({ example: 'scanner-class1', description: 'The module to craft' })
  module!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CRAFT_COUNT)
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_CRAFT_COUNT, default: 1 })
  count?: number
}

export class ResearchDto {
  @IsString()
  @Length(1, MODULE_NAME_MAX_LENGTH)
  @ApiProperty({ example: 'scanner-class2', description: 'The module whose blueprint to research' })
  module!: string
}

export class LearnDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid', description: 'A blueprint item held by the base' })
  itemId!: string
}

export class AssembleDto {
  @IsOptional()
  @IsString()
  @Length(1, BOT_LABEL_MAX_LENGTH)
  @ApiPropertyOptional({ maxLength: BOT_LABEL_MAX_LENGTH })
  label?: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTS_PER_BOT)
  @IsUUID(undefined, { each: true })
  @ApiProperty({ type: [String], format: 'uuid', description: 'Module parts held by the base' })
  partIds!: string[]
}
