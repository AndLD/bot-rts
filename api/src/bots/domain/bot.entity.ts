import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { Heading, Location } from '../../../../lib/utils/interfaces/map'

// Only a base has `userId`; any other bot belongs to a base (`baseId`), design §8.1
export interface Bot {
  readonly id: string
  readonly label: string | null
  readonly type: BOT_TYPE
  readonly userId: string | null
  readonly baseId: string | null
  // The hash of the access password others need to connect (design §11.2.2); a base always has one
  readonly passwordHash: string | null
  // Where the bot was when its last module was taken apart; such a bot has no cell on the map any more (design §8.4.1)
  readonly lastPosition: Location | null
  // The way the bot faces; `move` goes this way and `turn` changes it (design §10.2)
  readonly heading: Heading
}
