import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IMapPoint, Location, MapPointType } from '../../../../lib/utils/interfaces/map'
import { IResourceStack, RESOURCE } from '../../../../lib/utils/interfaces/resources'

class LocationModel implements Location {
  @ApiProperty()
  x!: number

  @ApiProperty()
  y!: number

  @ApiPropertyOptional({ description: 'Reserved: the world is 2D' })
  z?: number
}

class ResourceStackModel implements IResourceStack {
  @ApiProperty({ enum: RESOURCE })
  resource!: RESOURCE

  @ApiProperty({ description: 'What is left of the deposit' })
  amount!: number
}

export class MapPointResponse implements IMapPoint {
  @ApiProperty({ format: 'uuid' })
  _id!: string

  @ApiProperty({ type: LocationModel })
  location!: LocationModel

  @ApiPropertyOptional({ format: 'uuid', description: "Set on a point of a player's knowledge" })
  userId?: string

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  contentId!: string | null

  @ApiProperty({ enum: MapPointType, nullable: true })
  type!: MapPointType | null

  @ApiPropertyOptional({ type: ResourceStackModel })
  resource?: ResourceStackModel

  @ApiPropertyOptional({ description: 'The game tick the snapshot was taken at' })
  seenAt?: number
}
