import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
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
import { ListBotsQueryDto } from './dto/bots.dto'
import { toBotDto } from './bot.mapper'

const botIdPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

export interface DeployedBaseDto {
  bot: IBot
  modules: ModuleProps[]
  mapPoint: IMapPoint
}

@ApiTags('bots')
@ApiBearerAuth()
@Controller({ path: 'bots', version: '1' })
export class BotsController {
  constructor(
    private readonly bots: BotsService,
    private readonly scanService: ScanService
  ) {}

  // Deploys the first base of the player (design §5)
  @Post('base')
  async deployBase(@CurrentPrincipal() { user }: Principal): Promise<DeployedBaseDto> {
    const { bot, modules, mapPoint } = await this.bots.deployUserBase({ id: user.id, name: user.name })

    return { bot: toBotDto(bot), modules: modules.map(toModuleDto), mapPoint: toMapPointDto(mapPoint) }
  }

  @Get()
  async list(@CurrentPrincipal() { user }: Principal, @Query() query: ListBotsQueryDto): Promise<IBot[]> {
    return (await this.bots.listUserBots(user.id, { type: query.type })).map(toBotDto)
  }

  // The ordinary bots of one of the player's bases (design §8.4)
  @Get(':id/bots')
  async baseBots(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<IBot[]> {
    return (await this.bots.listBaseBots(user.id, id)).map(toBotDto)
  }

  @Get(':id/modules')
  async modules(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<ModuleProps[]> {
    return (await this.bots.getBotModules(user.id, id)).map(toModuleDto)
  }

  // The bot looks around with its scanner; the cells it sees become the player's knowledge
  @HttpCode(200)
  @Post(':id/scan')
  async scan(@CurrentPrincipal() { user }: Principal, @Param('id', botIdPipe) id: string): Promise<IMapPoint[]> {
    return (await this.scanService.scan(user.id, id)).map(toMapPointDto)
  }
}
