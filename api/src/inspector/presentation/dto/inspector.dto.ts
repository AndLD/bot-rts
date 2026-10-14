import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator'
import {
  HEATMAP_BUCKETS,
  HEATMAP_KINDS,
  HeatmapKind,
  IHeatBucket,
  IHeatmap,
  IInspectorBot,
  IInspectorDrive,
  IInspectorExecution,
  IInspectorFile,
  IInspectorFileContent,
  IInspectorLog,
  IInspectorModule,
  IInspectorSearchResult,
  SEARCH_RESULT_KINDS,
  SearchResultKind
} from '../../../../../lib/utils/admin-inspector'
import { MapRangeQueryDto } from '../../../mapview/presentation/map.dto'

export class SearchQueryDto {
  @IsString()
  @Length(1, 100)
  @ApiProperty({ description: 'The id of a bot, a base or a player, or a cell like 12,-4' })
  q!: string
}

export class DirectoryQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 512)
  @ApiPropertyOptional({ description: 'A directory of the drive; omitted: the root' })
  dir?: string
}

export class FilePathQueryDto {
  @IsString()
  @Length(1, 512)
  @ApiProperty()
  path!: string
}

export class HeatmapQueryDto extends MapRangeQueryDto {
  @IsIn(HEATMAP_KINDS)
  @ApiProperty({ enum: HEATMAP_KINDS })
  kind!: HeatmapKind

  @Type(() => Number)
  @IsInt()
  @IsIn(HEATMAP_BUCKETS)
  @ApiProperty({ enum: HEATMAP_BUCKETS, description: 'Cells per side of a bucket' })
  bucket!: number
}

class InspectorModuleModel implements IInspectorModule {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  type!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  condition!: number

  @ApiProperty()
  maxCondition!: number

  @ApiProperty()
  weight!: number

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  props!: Record<string, string>
}

class InspectorExecutionModel implements IInspectorExecution {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  file!: string

  @ApiProperty({ enum: ['active', 'finished', 'killed'] })
  status!: 'active' | 'finished' | 'killed'

  @ApiProperty()
  restarts!: number

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null

  @ApiProperty()
  createdAt!: number

  @ApiProperty({ type: Number, nullable: true })
  endedAt!: number | null
}

class InspectorLogModel implements IInspectorLog {
  @ApiProperty()
  at!: number

  @ApiProperty()
  kind!: string

  @ApiProperty()
  text!: string
}

class InspectorDriveModel implements IInspectorDrive {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  quota!: number

  @ApiProperty()
  usedBytes!: number
}

class PositionModel {
  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number
}

class EnergyModel {
  @ApiProperty()
  stored!: number

  @ApiProperty()
  capacity!: number
}

class StockModel {
  @ApiProperty()
  resource!: string

  @ApiProperty()
  amount!: number
}

export class InspectorBotResponse implements IInspectorBot {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ type: String, nullable: true })
  label!: string | null

  @ApiProperty({ enum: ['base', 'worker'] })
  type!: 'base' | 'worker'

  @ApiProperty({ type: String, nullable: true })
  ownerId!: string | null

  @ApiProperty({ type: String, nullable: true })
  ownerName!: string | null

  @ApiProperty({ type: String, nullable: true })
  baseId!: string | null

  @ApiProperty({ type: PositionModel, nullable: true })
  position!: PositionModel | null

  @ApiProperty()
  heading!: number

  @ApiProperty({ type: EnergyModel })
  energy!: EnergyModel

  @ApiProperty({ type: [StockModel] })
  storage!: StockModel[]

  @ApiProperty({ type: [InspectorModuleModel] })
  modules!: InspectorModuleModel[]

  @ApiProperty({ type: [InspectorDriveModel] })
  drives!: InspectorDriveModel[]

  @ApiProperty({ type: [InspectorExecutionModel] })
  executions!: InspectorExecutionModel[]

  @ApiProperty({ type: [InspectorLogModel] })
  logs!: InspectorLogModel[]
}

export class InspectorFileResponse implements IInspectorFile {
  @ApiProperty()
  path!: string

  @ApiProperty({ enum: ['file', 'directory'] })
  kind!: 'file' | 'directory'

  @ApiProperty()
  size!: number
}

export class InspectorFileContentResponse implements IInspectorFileContent {
  @ApiProperty()
  path!: string

  @ApiProperty()
  size!: number

  @ApiProperty()
  content!: string
}

export class SearchResultResponse implements IInspectorSearchResult {
  @ApiProperty({ enum: SEARCH_RESULT_KINDS })
  kind!: SearchResultKind

  @ApiProperty({ type: String, nullable: true })
  id!: string | null

  @ApiProperty()
  label!: string

  @ApiProperty({ type: Number, nullable: true })
  x!: number | null

  @ApiProperty({ type: Number, nullable: true })
  y!: number | null
}

class HeatBucketModel implements IHeatBucket {
  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number

  @ApiProperty()
  intensity!: number

  @ApiProperty()
  value!: number
}

export class HeatmapResponse implements IHeatmap {
  @ApiProperty({ enum: HEATMAP_KINDS })
  kind!: HeatmapKind

  @ApiProperty()
  bucket!: number

  @ApiProperty({ type: [HeatBucketModel] })
  buckets!: HeatBucketModel[]
}
