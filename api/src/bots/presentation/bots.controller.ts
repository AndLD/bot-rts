import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { RequireFeatures } from '../../featureswitches/presentation/require-feature.decorator'
import { ApiBearerAuth, ApiCreatedResponse, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IBot } from '../../../../lib/utils/interfaces/bots'
import { IMapPoint } from '../../../../lib/utils/interfaces/map'
import { ModuleProps } from '../../../../lib/utils/interfaces/modules'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { toMapPointDto } from '../../map/presentation/map-point.mapper'
import { toModuleDto } from '../../modules/presentation/module.mapper'
import { ValidationError } from '../../shared/domain/errors'
import { BotsService } from '../application/bots.service'
import { ScanService } from '../application/scan.service'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { MapPointResponse } from '../../map/presentation/map-point.response'
import { ModuleResponse } from '../../modules/presentation/module.response'
import { BotResponse, DeployedBaseResponse } from './dto/bots.response'
import { DeployBaseDto, ListBotsQueryDto } from './dto/bots.dto'
import { toBotDto } from './bot.mapper'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const botIdPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

export interface DeployedBaseDto {
  bot: IBot
  modules: ModuleProps[]
  mapPoint: IMapPoint
}

@ApiTags('bots')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'bots', version: '1' })
export class BotsController {
  constructor(
    private readonly bots: BotsService,
    private readonly scanService: ScanService
  ) {}

  // Deploys the first base of the player (design §5)
  @ApiCreatedResponse({ type: DeployedBaseResponse })
  @RequireScope('base')
  @RequireFeatures(
    { feature: 'baseDeployment' },
    {
      feature: 'spawnSeeds',
      when: (request) => Boolean((request.body as { spawnSeed?: string } | undefined)?.spawnSeed)
    }
  )
  @Post('base')
  async deployBase(@CurrentPrincipal() { user }: Principal, @Body() body: DeployBaseDto): Promise<DeployedBaseDto> {
    const { bot, modules, mapPoint } = await this.bots.deployUserBase(
      { id: user.id, name: user.name },
      { password: body.password, seedCode: body.spawnSeed }
    )

    return { bot: toBotDto(bot), modules: modules.map(toModuleDto), mapPoint: toMapPointDto(mapPoint) }
  }

  @ApiOkResponse({ type: [BotResponse] })
  @RequireScope('read')
  @Get()
  async list(@CurrentPrincipal() { user }: Principal, @Query() query: ListBotsQueryDto): Promise<IBot[]> {
    return (await this.bots.listUserBots(user.id, { type: query.type })).map(toBotDto)
  }

  // The ordinary bots of one of the player's bases (design §8.4)
  @ApiOkResponse({ type: [BotResponse] })
  @RequireScope('read')
  @Get(':id/bots')
  async baseBots(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<IBot[]> {
    return (await this.bots.listBaseBots(user.id, id)).map(toBotDto)
  }

  @ApiOkResponse({ type: [ModuleResponse] })
  @RequireScope('read')
  @Get(':id/modules')
  async modules(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<ModuleProps[]> {
    return (await this.bots.getBotModules(user.id, id)).map(toModuleDto)
  }

  // The bot looks around with its scanner; the cells it sees become the player's knowledge
  @HttpCode(200)
  @ApiOkResponse({ type: [MapPointResponse] })
  @RequireScope('read')
  @Post(':id/scan')
  async scan(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<IMapPoint[]> {
    return (await this.scanService.scan(user.id, id)).map(toMapPointDto)
  }
}
