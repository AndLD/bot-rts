import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsPositive, IsString, Length, Max, ValidateNested } from 'class-validator'
import {
  ANNOUNCEMENT_MAX_LENGTH,
  BANNER_MAX_LENGTH,
  IAnnouncementResult,
  IBackupStatus,
  IEngineStatus,
  IJobStatus,
  IMaintenanceBanner,
  IMaintenanceStatus,
  IOperationsStatus,
  IRestartResult
} from '../../../../../lib/utils/admin-operations'
import { ReasonDto } from '../../../players/presentation/dto/players.dto'

// Milliseconds since the epoch, far enough to be a date and near enough to be exact
const MAX_TIME = 8_640_000_000_000_000

export class AnnounceDto extends ReasonDto {
  @IsString()
  @Length(1, ANNOUNCEMENT_MAX_LENGTH)
  @ApiProperty({ minLength: 1, maxLength: ANNOUNCEMENT_MAX_LENGTH, description: 'What every player is told' })
  text!: string
}

export class MaintenanceBannerDto extends ReasonDto {
  @IsString()
  @Length(1, BANNER_MAX_LENGTH)
  @ApiProperty({ minLength: 1, maxLength: BANNER_MAX_LENGTH })
  message!: string

  @IsInt()
  @IsPositive()
  @Max(MAX_TIME)
  @ApiProperty({ description: 'When maintenance starts (ms since the epoch)' })
  startsAt!: number

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_TIME)
  @ApiProperty({ type: Number, nullable: true, required: false, description: 'When it should end, if known' })
  endsAt?: number | null
}

export class MaintenanceBannerModel implements IMaintenanceBanner {
  @ApiProperty()
  message!: string

  @ApiProperty()
  startsAt!: number

  @ApiProperty({ type: Number, nullable: true })
  endsAt!: number | null
}

export class MaintenanceStatusResponse implements IMaintenanceStatus {
  @ApiProperty()
  isPaused!: boolean

  @ApiProperty({ type: MaintenanceBannerModel, nullable: true })
  banner!: MaintenanceBannerModel | null
}

class EngineStatusModel implements IEngineStatus {
  @ApiProperty()
  isResponding!: boolean

  @ApiProperty()
  uptimeMs!: number

  @ApiProperty()
  tick!: number

  @ApiProperty()
  lastTickMs!: number

  @ApiProperty()
  p95TickMs!: number

  @ApiProperty()
  executions!: number

  @ApiProperty()
  memoryBytes!: number
}

class JobStatusModel implements IJobStatus {
  @ApiProperty()
  name!: string

  @ApiProperty({ type: Number, nullable: true })
  lastRunAt!: number | null

  @ApiProperty()
  failures!: number

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  totals!: Record<string, number>
}

class BackupStatusModel implements IBackupStatus {
  @ApiProperty()
  isConfigured!: boolean

  @ApiProperty({ type: Number, nullable: true })
  finishedAt!: number | null

  @ApiProperty({ type: Number, nullable: true })
  sizeBytes!: number | null

  @ApiProperty({ type: String, nullable: true })
  location!: string | null
}

export class OperationsStatusResponse implements IOperationsStatus {
  @ApiProperty({ type: EngineStatusModel })
  @ValidateNested()
  @Type(() => EngineStatusModel)
  engine!: EngineStatusModel

  @ApiProperty()
  isPaused!: boolean

  @ApiProperty()
  areScriptsHalted!: boolean

  @ApiProperty({ type: [JobStatusModel] })
  jobs!: JobStatusModel[]

  @ApiProperty({ type: BackupStatusModel })
  backup!: BackupStatusModel

  @ApiProperty({ type: MaintenanceBannerModel, nullable: true })
  banner!: MaintenanceBannerModel | null
}

export class AnnouncementResultResponse implements IAnnouncementResult {
  @ApiProperty()
  recipients!: number
}

export class RestartResultResponse implements IRestartResult {
  @ApiProperty()
  restarted!: number

  @ApiProperty()
  failedBots!: number
}
