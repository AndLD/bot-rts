import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { IExecution } from '../../../../lib/utils/interfaces/executions'
import { ITerminalLogEntry } from '../../../../lib/utils/interfaces/terminal'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ValidationError } from '../../shared/domain/errors'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { SCRIPT_RUNNER, ScriptArgument, ScriptRunner } from '../application/script-runner'
import { ViewAsAudited } from '../../viewas/presentation/view-as.decorator'
import { TerminalService } from '../application/terminal.service'
import { toLogEntryDto } from './terminal.mapper'
import {
  ExecutionResponse,
  StartExecutionDto,
  TerminalHistoryQueryDto,
  TerminalLogEntryResponse
} from './executions.dto'

const DEFAULT_HISTORY_LINES = 100
const idPipe = new ParseUUIDPipe({ exceptionFactory: () => new ValidationError('Invalid id') })

// Scripts over HTTP, for clients that do not drive a terminal (design §22.1). The same engine runs them under the same rules
// as `run` and `kill` in the BotOS terminal; what they write arrives as `script-log` events and in the terminal history.
@ApiTags('scripts')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ version: '1' })
export class ExecutionsController {
  constructor(
    @Inject(SCRIPT_RUNNER) private readonly runner: ScriptRunner,
    private readonly terminal: TerminalService
  ) {}

  @ApiOkResponse({
    type: ExecutionResponse,
    isArray: true,
    description: 'The scripts of the player that are still running'
  })
  @RequireScope('read')
  @Get('executions')
  list(@CurrentPrincipal() { user }: Principal): Promise<IExecution[]> {
    return this.runner.list(user.id)
  }

  @HttpCode(201)
  @ApiOkResponse({ type: ExecutionResponse })
  @RequireScope('scripts')
  @Post('bots/:botId/executions')
  start(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Body() body: StartExecutionDto
  ): Promise<IExecution> {
    const args = (body.args ?? []).filter((arg): arg is ScriptArgument =>
      ['string', 'number', 'boolean'].includes(typeof arg)
    )
    if (args.length !== (body.args ?? []).length) {
      throw new ValidationError('Arguments must be strings, numbers or booleans')
    }

    return this.runner.start(user.id, botId, body.file, args)
  }

  @HttpCode(200)
  @ApiOkResponse({ type: ExecutionResponse })
  @RequireScope('scripts')
  @Delete('executions/:executionId')
  kill(
    @CurrentPrincipal() { user }: Principal,
    @Param('executionId', idPipe) executionId: string
  ): Promise<IExecution> {
    return this.runner.kill(user.id, executionId)
  }

  // What a bot's terminal sessions and its scripts wrote, oldest first (the `get-terminal-history` event of the socket)
  @ApiOkResponse({ type: TerminalLogEntryResponse, isArray: true })
  @RequireScope('read')
  @ViewAsAudited('terminal.history')
  @Get('bots/:botId/terminal-history')
  async history(
    @CurrentPrincipal() { user }: Principal,
    @Param('botId', idPipe) botId: string,
    @Query() query: TerminalHistoryQueryDto
  ): Promise<ITerminalLogEntry[]> {
    return (await this.terminal.history(user.id, botId, query.limit ?? DEFAULT_HISTORY_LINES)).map(toLogEntryDto)
  }
}
