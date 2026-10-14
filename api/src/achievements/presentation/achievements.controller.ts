import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'
import { IAchievement } from '../../../../lib/utils/interfaces/achievements'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { AchievementService } from '../application/achievement.service'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

export class AchievementResponse implements IAchievement {
  @ApiProperty({ description: 'For example `prospector.2`' })
  id!: string

  @ApiProperty({ description: 'The idea it belongs to; its texts are the translation keys of the family' })
  family!: string

  @ApiProperty()
  level!: number

  @ApiProperty({ description: 'How many levels the family has' })
  levels!: number

  @ApiProperty({ description: 'What the counter must reach to unlock it' })
  threshold!: number

  @ApiProperty({ description: 'Where the counter is now, at most the threshold' })
  progress!: number

  @ApiProperty({ type: Number, nullable: true, description: 'When it was unlocked (ms since the epoch)' })
  unlockedAt!: number | null
}

// What the player has earned and how far they are from the rest (design §23)
@ApiTags('achievements')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(private readonly achievements: AchievementService) {}

  @ApiOkResponse({ type: [AchievementResponse] })
  @RequireScope('read')
  @Get()
  list(@CurrentPrincipal() { user }: Principal): Promise<IAchievement[]> {
    return this.achievements.list(user.id)
  }
}
