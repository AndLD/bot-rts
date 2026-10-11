import { IsEnum, IsOptional } from 'class-validator'
import { BOT_TYPE } from '../../../../../lib/utils/interfaces/bots'

export class ListBotsQueryDto {
  @IsOptional()
  @IsEnum(BOT_TYPE)
  type?: BOT_TYPE
}
