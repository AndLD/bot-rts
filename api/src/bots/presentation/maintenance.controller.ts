import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ModuleProps } from '../../../../lib/utils/interfaces/modules'
import { IDisassembly } from '../../../../lib/utils/interfaces/crafting'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ModuleResponse } from '../../modules/presentation/module.response'
import { toModuleDto } from '../../modules/presentation/module.mapper'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { MaintenanceService } from '../application/maintenance.service'
import { DisassemblyResponse } from './dto/factory.response'
import { MaintenanceDto } from './dto/maintenance.dto'
import { toItemDto } from './factory.mapper'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// Repair and disassembly by a bot with a repair module (design §8.4.2)
@ApiTags('maintenance')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'bots/:botId/maintenance', version: '1' })
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  // Restores some condition of a module of a bot on an adjacent cell
  @HttpCode(200)
  @ApiOkResponse({ type: ModuleResponse, description: 'The module after the repair' })
  @RequireScope('maintenance')
  @Post('repair')
  async repair(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Body() body: MaintenanceDto
  ): Promise<ModuleProps> {
    return toModuleDto(await this.maintenance.repair(user.id, { repairerId: botId, ...body }))
  }

  // Takes a module of a bot on an adjacent cell apart; the scrap goes to this bot's storage
  @HttpCode(200)
  @ApiOkResponse({ type: DisassemblyResponse })
  @RequireScope('maintenance')
  @Post('disassemble')
  async disassemble(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Body() body: MaintenanceDto
  ): Promise<IDisassembly> {
    const { scrap, blueprint } = await this.maintenance.disassemble(user.id, { repairerId: botId, ...body })
    return { scrap, blueprint: blueprint && toItemDto(blueprint) }
  }
}
