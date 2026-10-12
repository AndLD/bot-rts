import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, ValidateIf } from 'class-validator'
import { CategorySwitches, IGameSettings, ISettings, IUserSettings } from '../../../../lib/utils/interfaces/settings'

// Whether each category of manual control is on (design §15.1)
class CategorySwitchesModel implements CategorySwitches {
  @ApiProperty() movement!: boolean
  @ApiProperty() combat!: boolean
  @ApiProperty() extraction!: boolean
  @ApiProperty() logistics!: boolean
  @ApiProperty() fabrication!: boolean
  @ApiProperty() maintenance!: boolean
  @ApiProperty() communication!: boolean
  @ApiProperty() trade!: boolean
}

// The switches to change; the others stay as they are
class CategorySwitchesPatchModel extends PartialType(CategorySwitchesModel) {}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ type: CategorySwitchesPatchModel })
  categories?: Record<string, unknown>

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, description: 'Reduce motion; null follows the system' })
  reducedMotion?: boolean | null
}

export class UpdateGameSettingsDto {
  @IsObject()
  @ApiProperty({ type: CategorySwitchesPatchModel })
  categories!: Record<string, unknown>
}

export class GameSettingsResponse implements IGameSettings {
  @ApiProperty({ type: CategorySwitchesModel })
  categories!: CategorySwitchesModel
}

class UserSettingsModel implements IUserSettings {
  @ApiProperty({ type: CategorySwitchesModel })
  categories!: CategorySwitchesModel

  @ApiProperty({ type: Boolean, nullable: true })
  reducedMotion!: boolean | null
}

export class SettingsResponse implements ISettings {
  @ApiProperty({ type: GameSettingsResponse })
  global!: GameSettingsResponse

  @ApiProperty({ type: UserSettingsModel })
  user!: UserSettingsModel

  @ApiProperty({
    type: CategorySwitchesModel,
    description: 'What the player can use: the game and the player switches together'
  })
  effective!: CategorySwitchesModel
}
