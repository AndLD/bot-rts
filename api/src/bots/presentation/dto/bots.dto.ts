import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator'
import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'
import {
  BOT_PASSWORD_MAX_LENGTH,
  BOT_PASSWORD_MIN_LENGTH,
  SPAWN_SEED_PATTERN
} from '../../../../../lib/utils/validation'

export class ListBotsQueryDto {
  @IsOptional()
  @IsEnum(BOT_TYPE)
  @ApiPropertyOptional({ enum: BOT_TYPE })
  type?: BOT_TYPE
}

export class DeployBaseDto {
  // The access password of the new base (design §11.2.2)
  @IsString()
  @Length(BOT_PASSWORD_MIN_LENGTH, BOT_PASSWORD_MAX_LENGTH)
  @ApiProperty({ minLength: BOT_PASSWORD_MIN_LENGTH, maxLength: BOT_PASSWORD_MAX_LENGTH })
  password!: string

  // Start near the players who used the same code (design §22.3)
  @IsOptional()
  @IsString()
  @Matches(SPAWN_SEED_PATTERN)
  @ApiPropertyOptional({ pattern: SPAWN_SEED_PATTERN.source, example: 'ALPHA-7K2' })
  spawnSeed?: string
}
