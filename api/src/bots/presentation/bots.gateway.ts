import { Inject } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { AuthService } from '../../auth/application/auth.service'
import { createSocketAuthMiddleware } from '../../auth/presentation/socket-auth.middleware'
import { toModuleDto } from '../../modules/presentation/module.mapper'
import { LOGGER, Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { isValidId } from '../../shared/domain/ids'
import { guarded } from '../../shared/presentation/socket-handlers'
import { BotsService } from '../application/bots.service'
import { toBotDto } from './bot.mapper'

// The bot events of the game client. The acknowledgement protocol is `(result)` on success and `(null, { code, msg })`
// on failure, which the client's terminal relies on. The origin allowed to connect is set by the configured adapter.
@WebSocketGateway()
export class BotsGateway implements OnGatewayInit, OnGatewayConnection {
  constructor(
    private readonly bots: BotsService,
    private readonly auth: AuthService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  afterInit(server: Server) {
    server.use(createSocketAuthMiddleware(this.auth, this.logger))
  }

  handleConnection(socket: Socket) {
    const userId = () => (socket.principal as NonNullable<typeof socket.principal>).user.id

    socket.on(
      'get-user-bases',
      guarded(this.logger, async (ack) => {
        ack((await this.bots.listUserBots(userId(), { type: BOT_TYPE.BASE })).map(toBotDto))
      })
    )

    socket.on(
      'get-user-bots',
      guarded(this.logger, async (ack) => {
        ack((await this.bots.listUserBots(userId())).map(toBotDto))
      })
    )

    socket.on(
      'get-bot-modules',
      guarded(this.logger, async (ack, botId) => {
        if (!isValidId(botId)) {
          throw new ValidationError('Invalid id')
        }

        ack((await this.bots.getBotModules(userId(), botId)).map(toModuleDto))
      })
    )
  }
}
