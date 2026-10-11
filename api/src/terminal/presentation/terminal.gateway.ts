import { Inject } from '@nestjs/common'
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { LOGGER, Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { isValidId } from '../../shared/domain/ids'
import { guarded } from '../../shared/presentation/socket-handlers'
import { TerminalService } from '../application/terminal.service'
import { toLogEntryDto, toSessionDto } from './terminal.mapper'

const MAX_HISTORY_LINES = 1000

// The terminal events of the game client: stored sessions and their history. A session lives until it is closed or
// its socket disconnects.
@WebSocketGateway()
export class TerminalGateway implements OnGatewayConnection {
  constructor(
    private readonly terminal: TerminalService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  handleConnection(socket: Socket) {
    const userId = () => (socket.principal as NonNullable<typeof socket.principal>).user.id
    const openSessions = new Set<string>()

    socket.on(
      'open-terminal',
      guarded(this.logger, async (ack, botId) => {
        if (!isValidId(botId)) {
          throw new ValidationError('Invalid id')
        }
        const session = await this.terminal.open(userId(), botId)
        openSessions.add(session.id)
        ack(toSessionDto(session))
      })
    )

    socket.on(
      'close-terminal',
      guarded(this.logger, async (ack, sessionId) => {
        if (!isValidId(sessionId)) {
          throw new ValidationError('Invalid id')
        }
        const session = await this.terminal.close(userId(), sessionId)
        openSessions.delete(session.id)
        ack(toSessionDto(session))
      })
    )

    socket.on(
      'get-terminal-history',
      guarded(this.logger, async (ack, botId, limit) => {
        if (!isValidId(botId) || !Number.isInteger(limit) || (limit as number) < 1) {
          throw new ValidationError('Invalid history request')
        }
        const entries = await this.terminal.history(userId(), botId, Math.min(limit as number, MAX_HISTORY_LINES))
        ack(entries.map(toLogEntryDto))
      })
    )

    socket.on('disconnect', () => {
      for (const sessionId of openSessions) {
        this.terminal.close(userId(), sessionId).catch((error) => this.logger.error(error))
      }
    })
  }
}
