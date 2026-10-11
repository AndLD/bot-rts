import { Inject } from '@nestjs/common'
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { LOGGER, Logger } from '../../shared/application/logger'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'
import { isValidId } from '../../shared/domain/ids'
import { guarded } from '../../shared/presentation/socket-handlers'
import { Cwd, TOP } from '../application/shell/cwd'
import { TerminalShell } from '../application/shell/terminal-shell.service'
import { TerminalService } from '../application/terminal.service'
import { toFileDto } from '../../files/presentation/file.mapper'
import { toLogEntryDto, toSessionDto } from './terminal.mapper'

const MAX_HISTORY_LINES = 1000
const MAX_LINE_LENGTH = 1000

// The terminal events of the game client: stored sessions and their history. A session lives until it is closed or
// its socket disconnects.
@WebSocketGateway()
export class TerminalGateway implements OnGatewayConnection {
  constructor(
    private readonly terminal: TerminalService,
    private readonly shell: TerminalShell,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  handleConnection(socket: Socket) {
    const userId = () => (socket.principal as NonNullable<typeof socket.principal>).user.id
    // The sessions this socket opened, each with the place its terminal is in
    const openSessions = new Map<string, Cwd>()

    socket.on(
      'open-terminal',
      guarded(this.logger, async (ack, botId) => {
        if (!isValidId(botId)) {
          throw new ValidationError('Invalid id')
        }
        const session = await this.terminal.open(userId(), botId)
        openSessions.set(session.id, TOP)
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
      'terminal-command',
      guarded(this.logger, async (ack, sessionId, line) => {
        if (!isValidId(sessionId) || typeof line !== 'string' || line.length > MAX_LINE_LENGTH) {
          throw new ValidationError('Invalid command')
        }
        const reply = await this.shell.execute(userId(), sessionId, line, this.placeOf(openSessions, sessionId))
        openSessions.set(sessionId, reply.cwd)
        ack(reply.response)
      })
    )

    socket.on(
      'save-terminal-file',
      guarded(this.logger, async (ack, sessionId, path, content) => {
        if (!isValidId(sessionId) || typeof path !== 'string' || typeof content !== 'string') {
          throw new ValidationError('Invalid file')
        }
        const cwd = this.placeOf(openSessions, sessionId)
        ack(toFileDto(await this.shell.saveFile(userId(), sessionId, cwd, path, content)))
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
      for (const sessionId of openSessions.keys()) {
        this.terminal.close(userId(), sessionId).catch((error) => this.logger.error(error))
      }
    })
  }

  // A session is driven only through the socket that opened it
  private placeOf(openSessions: Map<string, Cwd>, sessionId: string): Cwd {
    const cwd = openSessions.get(sessionId)
    if (!cwd) {
      throw new ForbiddenError('The terminal session was opened on another connection')
    }
    return cwd
  }
}
