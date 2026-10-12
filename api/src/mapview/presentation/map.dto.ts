import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt } from 'class-validator'
import {
  ILiveArea,
  IMapCell,
  IMapView,
  MapChassis,
  MapItemKind,
  MapModuleIcon,
  MapPointType
} from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'

export class MapRangeQueryDto {
  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  minX!: number

  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  minY!: number

  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  maxX!: number

  @Type(() => Number)
  @IsInt()
  @ApiProperty()
  maxY!: number
}

class ResourceModel {
  @ApiProperty({ enum: RESOURCE })
  resource!: RESOURCE

  @ApiProperty()
  amount!: number
}

export class MapCellResponse implements IMapCell {
  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number

  @ApiProperty({ enum: MapPointType, nullable: true })
  type!: MapPointType | null

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  contentId!: string | null

  @ApiProperty({ description: 'Game time of the snapshot, in ms' })
  seenAt!: number

  @ApiPropertyOptional({ type: ResourceModel })
  resource?: ResourceModel

  @ApiPropertyOptional({ description: 'What the deposit held when it was generated' })
  capacity?: number

  @ApiPropertyOptional({ description: 'On bots and bases: whether they are the requesting player’s' })
  isOwn?: boolean

  @ApiPropertyOptional({ enum: ['wheels', 'tracks', 'immobile'] })
  chassis?: MapChassis

  @ApiPropertyOptional({ enum: ['weapon', 'drill', 'scanner', 'antenna'], isArray: true })
  icons?: MapModuleIcon[]

  @ApiPropertyOptional()
  isDamaged?: boolean

  @ApiPropertyOptional({ enum: ['blueprint', 'ammunition', 'part', 'generic'] })
  item?: MapItemKind
}

export class LiveAreaResponse implements ILiveArea {
  @ApiProperty({ format: 'uuid' })
  scannerId!: string

  @ApiProperty({ format: 'uuid' })
  botId!: string

  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number

  @ApiProperty()
  radius!: number
}

export class MapViewResponse implements IMapView {
  @ApiProperty({ description: 'Game time of the server, in ms' })
  now!: number

  @ApiProperty({ type: [MapCellResponse] })
  cells!: MapCellResponse[]

  @ApiProperty({ type: [LiveAreaResponse] })
  liveAreas!: LiveAreaResponse[]
}

export class BotPositionResponse {
  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number
}
