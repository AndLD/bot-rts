import { Inject } from '@nestjs/common'
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { LOGGER, Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'
import { guarded } from '../../shared/presentation/socket-handlers'
import { MapViewService } from '../application/map-view.service'

@WebSocketGateway()
export class MapGateway implements OnGatewayConnection {
  constructor(
    private readonly view: MapViewService,
    @Inject(LOGGER) private readonly logger: Logger
  ) {}

  handleConnection(socket: Socket) {
    socket.on(
      'get-map',
      guarded(this.logger, async (ack, range) => {
        if (typeof range !== 'object' || range === null) {
          throw new ValidationError('Invalid map range')
        }
        const { minX, minY, maxX, maxY } = range as Record<string, number>
        const principal = socket.principal as NonNullable<typeof socket.principal>

        ack(await this.view.view(principal.user.id, { minX, minY, maxX, maxY }))
      })
    )
  }
}
