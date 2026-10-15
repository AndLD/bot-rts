import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { GameTimeService, GameTimeView } from '../application/game-time.service'
import { GameTimeResponse } from './game-time.response'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

@ApiTags('time')
@ApiBearerAuth()
@ApiDefaultResponse({ type: ErrorResponseModel })
@Controller({ path: 'time', version: '1' })
export class GameTimeController {
  constructor(private readonly time: GameTimeService) {}

  @RequireScope('read')
  @Get()
  @ApiOperation({ summary: 'The server instant and the day/night config (design §12.4)' })
  @ApiOkResponse({ type: GameTimeResponse })
  current(): Promise<GameTimeView> {
    return this.time.current()
  }
}
