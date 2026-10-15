import { ApiProperty } from '@nestjs/swagger'
import { IViewAsStart } from '../../../../../lib/utils/admin-players'

class ViewAsPlayerModel {
  @ApiProperty()
  _id!: string

  @ApiProperty()
  name!: string
}

export class ViewAsStartResponse implements IViewAsStart {
  @ApiProperty({ description: 'A token for the game screens of the player; it is read-only and ends at `expiresAt`' })
  accessToken!: string

  @ApiProperty({ description: 'Milliseconds since the epoch' })
  expiresAt!: number

  @ApiProperty({ type: ViewAsPlayerModel })
  player!: ViewAsPlayerModel
}
