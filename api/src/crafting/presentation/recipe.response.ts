import { ApiProperty } from '@nestjs/swagger'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'

export class RecipeResourceResponse {
  @ApiProperty({ enum: RESOURCE })
  resource!: RESOURCE

  @ApiProperty()
  amount!: number
}

export class ResearchCostResponse {
  @ApiProperty({ type: [RecipeResourceResponse] })
  resources!: RecipeResourceResponse[]

  @ApiProperty({ description: 'ms' })
  timeMs!: number
}

export class RecipeResponse {
  @ApiProperty({ example: 'scanner-class1', description: 'The module the recipe builds' })
  module!: string

  @ApiProperty({ description: 'Class 1 is the base set every player knows' })
  classLevel!: number

  @ApiProperty({ type: [RecipeResourceResponse] })
  resources!: RecipeResourceResponse[]

  @ApiProperty({ description: 'ms the factory needs' })
  craftTimeMs!: number

  @ApiProperty({ description: 'The player has the blueprint' })
  isKnown!: boolean

  @ApiProperty({ description: 'The player can research it: the class below it is known' })
  canResearch!: boolean

  @ApiProperty({ type: ResearchCostResponse, nullable: true, description: 'Classes above 1 only' })
  research!: ResearchCostResponse | null
}
