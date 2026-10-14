import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IBlueprint, IFactoryJob, IFactoryStatus } from '../../../../lib/utils/interfaces/crafting'
import { IBotWithModules } from '../../../../lib/utils/interfaces/bots'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { AssemblyService } from '../application/assembly.service'
import { FactoryService } from '../application/factory.service'
import { AssembleDto, CraftDto, LearnDto, ResearchDto } from './dto/factory.dto'
import {
  AssembledBotResponse,
  BlueprintResponse,
  FactoryJobResponse,
  FactoryStatusResponse
} from './dto/factory.response'
import { toAssembledBotDto, toBlueprintDto, toFactoryStatusDto, toJobDto } from './factory.mapper'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// The factory of a base: crafting, research, blueprints and assembly (design §9.3, §8.2)
@ApiTags('factory')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'bots/:baseId/factory', version: '1' })
export class FactoryController {
  constructor(
    private readonly factory: FactoryService,
    private readonly assembly: AssemblyService
  ) {}

  @ApiOkResponse({ type: FactoryStatusResponse })
  @RequireScope('read')
  @Get()
  async status(
    @CurrentPrincipal() { user }: Principal,
    @Param('baseId', idPipe) baseId: string
  ): Promise<IFactoryStatus> {
    return toFactoryStatusDto(await this.factory.status(user.id, baseId))
  }

  @ApiCreatedResponse({ type: [FactoryJobResponse] })
  @RequireScope('fabrication')
  @Post('craft')
  async craft(
    @CurrentPrincipal() { user }: Principal,
    @Param('baseId', idPipe) baseId: string,
    @Body() body: CraftDto
  ): Promise<IFactoryJob[]> {
    return (await this.factory.craft(user.id, baseId, body.module, body.count)).map(toJobDto)
  }

  @ApiCreatedResponse({ type: FactoryJobResponse })
  @RequireScope('fabrication')
  @Post('research')
  async research(
    @CurrentPrincipal() { user }: Principal,
    @Param('baseId', idPipe) baseId: string,
    @Body() body: ResearchDto
  ): Promise<IFactoryJob> {
    return toJobDto(await this.factory.research(user.id, baseId, body.module))
  }

  @ApiCreatedResponse({ type: BlueprintResponse })
  @RequireScope('fabrication')
  @Post('learn')
  async learn(
    @CurrentPrincipal() { user }: Principal,
    @Param('baseId', idPipe) baseId: string,
    @Body() body: LearnDto
  ): Promise<IBlueprint> {
    return toBlueprintDto(await this.factory.learn(user.id, baseId, body.itemId))
  }

  @ApiCreatedResponse({ type: AssembledBotResponse })
  @RequireScope('fabrication')
  @Post('assemble')
  async assemble(
    @CurrentPrincipal() { user }: Principal,
    @Param('baseId', idPipe) baseId: string,
    @Body() body: AssembleDto
  ): Promise<IBotWithModules> {
    return toAssembledBotDto(
      await this.assembly.assemble(user.id, { baseId, label: body.label ?? null, partIds: body.partIds })
    )
  }
}
