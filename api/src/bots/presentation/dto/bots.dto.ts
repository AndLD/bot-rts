import { IsEnum, IsOptional, IsString, Length } from 'class-validator'
import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'
import { BOT_PASSWORD_MAX_LENGTH, BOT_PASSWORD_MIN_LENGTH } from '../../../../../lib/utils/validation'

export class ListBotsQueryDto {
  @IsOptional()
  @IsEnum(BOT_TYPE)
  type?: BOT_TYPE
}

export class DeployBaseDto {
  // The access password of the new base (design §11.2.2)
  @IsString()
  @Length(BOT_PASSWORD_MIN_LENGTH, BOT_PASSWORD_MAX_LENGTH)
  password!: string
}
