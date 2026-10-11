import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'

// Only a base has `userId`; any other bot belongs to a base (`baseId`), design §8.1
export interface Bot {
  readonly id: string
  readonly label: string | null
  readonly type: BOT_TYPE
  readonly userId: string | null
  readonly baseId: string | null
  // The hash of the access password others need to connect (design §11.2.2); a base always has one
  readonly passwordHash: string | null
}
