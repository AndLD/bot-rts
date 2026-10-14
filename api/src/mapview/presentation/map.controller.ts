import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IMapView } from '../../../../lib/utils/interfaces/map'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { MapViewService } from '../application/map-view.service'
import { BotPositionResponse, MapRangeQueryDto, MapViewResponse } from './map.dto'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const botIdPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

@ApiTags('map')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'map', version: '1' })
export class MapController {
  constructor(private readonly view: MapViewService) {}

  // The player's map inside a range: what they have seen, with fog of war applied (design §4.2)
  @ApiOkResponse({ type: MapViewResponse })
  @RequireScope('read')
  @Get()
  async get(@CurrentPrincipal() { user }: Principal, @Query() range: MapRangeQueryDto): Promise<IMapView> {
    return this.view.view(user.id, range)
  }

  // The cell one of the player's own bots stands on, for centering the map
  @ApiOkResponse({ type: BotPositionResponse })
  @RequireScope('read')
  @Get('bots/:botId')
  async position(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', botIdPipe) botId: string
  ): Promise<{ x: number; y: number }> {
    return this.view.positionOf(user.id, botId)
  }
}
