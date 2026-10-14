import { Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'
import {
  ITutorial,
  ITutorialStep,
  TUTORIAL_STEPS,
  TutorialStatus,
  TutorialStep
} from '../../../../lib/utils/interfaces/tutorial'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { TutorialService } from '../application/tutorial.service'
import { RequireScope, SessionOnly } from '../../apikeys/presentation/scope.decorator'

class TutorialStepResponse implements ITutorialStep {
  @ApiProperty({ enum: TUTORIAL_STEPS })
  id!: TutorialStep

  @ApiProperty()
  isDone!: boolean
}

export class TutorialResponse implements ITutorial {
  @ApiProperty({ enum: ['active', 'skipped', 'completed'] })
  status!: TutorialStatus

  @ApiProperty({ type: [TutorialStepResponse] })
  steps!: TutorialStepResponse[]

  @ApiProperty({
    enum: TUTORIAL_STEPS,
    nullable: true,
    description: 'The first step not done, while the tutorial is active'
  })
  current!: TutorialStep | null
}

// The guided checklist after the first base (design §16.1)
@ApiTags('tutorial')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'tutorial', version: '1' })
export class TutorialController {
  constructor(private readonly tutorial: TutorialService) {}

  @ApiOkResponse({ type: TutorialResponse })
  @RequireScope('read')
  @Get()
  get(@CurrentPrincipal() { user }: Principal): Promise<ITutorial> {
    return this.tutorial.get(user.id)
  }

  @HttpCode(200)
  @ApiOkResponse({ type: TutorialResponse })
  @SessionOnly()
  @Post('skip')
  skip(@CurrentPrincipal() { user }: Principal): Promise<ITutorial> {
    return this.tutorial.skip(user.id)
  }

  // Starts again, from the profile settings
  @HttpCode(200)
  @ApiOkResponse({ type: TutorialResponse })
  @SessionOnly()
  @Post('restart')
  restart(@CurrentPrincipal() { user }: Principal): Promise<ITutorial> {
    return this.tutorial.restart(user.id)
  }
}
