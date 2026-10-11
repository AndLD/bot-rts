import { Inject } from '@nestjs/common'
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { MAX_CRAFT_COUNT } from '../../../../lib/utils/interfaces/crafting'
import { LOGGER, Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { isValidId } from '../../shared/domain/ids'
import { guarded } from '../../shared/presentation/socket-handlers'
import { AssemblyService } from '../application/assembly.service'
import { FactoryService } from '../application/factory.service'
import { BOT_LABEL_MAX_LENGTH, MAX_PARTS_PER_BOT, MODULE_NAME_MAX_LENGTH } from './dto/factory.dto'
import { toAssembledBotDto, toBlueprintDto, toFactoryStatusDto, toJobDto } from './factory.mapper'

const isModuleName = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MODULE_NAME_MAX_LENGTH

// The factory events of the game client, with the same acknowledgement protocol as the bot events
@WebSocketGateway()
export class FactoryGateway implements OnGatewayConnection {
  constructor(
    private readonly factory: FactoryService,
    private readonly assembly: AssemblyService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  handleConnection(socket: Socket) {
    const userId = () => (socket.principal as NonNullable<typeof socket.principal>).user.id

    socket.on(
      'get-factory',
      guarded(this.logger, async (ack, baseId) => {
        if (!isValidId(baseId)) {
          throw new ValidationError('Invalid id')
        }
        ack(toFactoryStatusDto(await this.factory.status(userId(), baseId)))
      })
    )

    socket.on(
      'craft-module',
      guarded(this.logger, async (ack, baseId, module, count) => {
        if (!isValidId(baseId) || !isModuleName(module) || (count !== undefined && typeof count !== 'number')) {
          throw new ValidationError('Invalid craft order')
        }
        if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > MAX_CRAFT_COUNT)) {
          throw new ValidationError(`Craft between 1 and ${MAX_CRAFT_COUNT} modules at a time`)
        }
        ack((await this.factory.craft(userId(), baseId, module, count)).map(toJobDto))
      })
    )

    socket.on(
      'research-module',
      guarded(this.logger, async (ack, baseId, module) => {
        if (!isValidId(baseId) || !isModuleName(module)) {
          throw new ValidationError('Invalid research order')
        }
        ack(toJobDto(await this.factory.research(userId(), baseId, module)))
      })
    )

    socket.on(
      'learn-blueprint',
      guarded(this.logger, async (ack, baseId, itemId) => {
        if (!isValidId(baseId) || !isValidId(itemId)) {
          throw new ValidationError('Invalid id')
        }
        ack(toBlueprintDto(await this.factory.learn(userId(), baseId, itemId)))
      })
    )

    socket.on(
      'assemble-bot',
      guarded(this.logger, async (ack, baseId, label, partIds) => {
        const validLabel = label === null || (typeof label === 'string' && label.length <= BOT_LABEL_MAX_LENGTH)
        const validParts =
          Array.isArray(partIds) &&
          partIds.length > 0 &&
          partIds.length <= MAX_PARTS_PER_BOT &&
          partIds.every(isValidId)
        if (!isValidId(baseId) || !validLabel || !validParts) {
          throw new ValidationError('Invalid assembly order')
        }
        ack(
          toAssembledBotDto(await this.assembly.assemble(userId(), { baseId, label: label as string | null, partIds }))
        )
      })
    )
  }
}
