import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'
import {
  IBalanceChange,
  IBalancePreview,
  IBalanceState,
  IBalanceValue,
  IBalanceVersion,
  IBlueprintStat,
  IEconomyOverview,
  IEconomyStat,
  IModuleStat
} from '../../../../../lib/utils/admin-balance'
import { ReasonDto } from '../../../players/presentation/dto/players.dto'

const DOCUMENT = { type: 'object', additionalProperties: { type: 'object' } } as const

export class BalanceDocumentDto {
  @IsObject()
  @ApiProperty({ ...DOCUMENT, description: 'Only what differs from the defaults: resources, recipes, crafting' })
  document!: Record<string, object>
}

export class SaveBalanceDto extends ReasonDto {
  @IsObject()
  @ApiProperty({ ...DOCUMENT, description: 'Only what differs from the defaults: resources, recipes, crafting' })
  document!: Record<string, object>
}

class BalanceChangeModel implements IBalanceChange {
  @ApiProperty()
  path!: string

  @ApiProperty({ type: String, nullable: true })
  from!: string | null

  @ApiProperty({ type: String, nullable: true })
  to!: string | null
}

export class BalancePreviewResponse implements IBalancePreview {
  @ApiProperty({ type: [String] })
  problems!: string[]

  @ApiProperty({ type: [BalanceChangeModel] })
  changes!: BalanceChangeModel[]
}

class BalanceValueModel implements IBalanceValue {
  @ApiProperty()
  path!: string

  @ApiProperty()
  value!: string
}

class BalanceVersionModel implements IBalanceVersion {
  @ApiProperty()
  version!: number

  @ApiProperty()
  reason!: string

  @ApiProperty({ format: 'uuid' })
  createdBy!: string

  @ApiProperty()
  createdAt!: number

  @ApiProperty()
  isActive!: boolean
}

export class BalanceStateResponse implements IBalanceState {
  @ApiProperty({ type: Number, nullable: true })
  activeVersion!: number | null

  @ApiProperty({ type: Number, nullable: true })
  runningVersion!: number | null

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the stored version could not be used, when it could not'
  })
  problem!: string | null

  @ApiProperty()
  documentJson!: string

  @ApiProperty({ type: [BalanceValueModel] })
  effective!: BalanceValueModel[]

  @ApiProperty({ type: [BalanceVersionModel] })
  versions!: BalanceVersionModel[]
}

export class BalanceVersionDocumentResponse {
  @ApiProperty()
  documentJson!: string
}

class EconomyStatModel implements IEconomyStat {
  @ApiProperty()
  resource!: string

  @ApiProperty()
  deposits!: number

  @ApiProperty()
  depleted!: number

  @ApiProperty()
  remaining!: number

  @ApiProperty()
  capacity!: number

  @ApiProperty()
  stored!: number
}

class BlueprintStatModel implements IBlueprintStat {
  @ApiProperty()
  module!: string

  @ApiProperty()
  research!: number

  @ApiProperty()
  item!: number
}

class ModuleStatModel implements IModuleStat {
  @ApiProperty()
  type!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  count!: number
}

export class EconomyOverviewResponse implements IEconomyOverview {
  @ApiProperty({ type: [EconomyStatModel] })
  resources!: EconomyStatModel[]

  @ApiProperty({ type: [BlueprintStatModel] })
  blueprints!: BlueprintStatModel[]

  @ApiProperty({ type: [ModuleStatModel] })
  modules!: ModuleStatModel[]
}
