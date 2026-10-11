import { AuthService } from '../auth/application/auth.service'
import { BotsService } from '../bots/application/bots.service'
import { ScanService } from '../bots/application/scan.service'

export const LEGACY_SERVICES = Symbol('LegacyServices')

// The use cases the legacy Express routers and the Socket.IO server need; removed together with them in task 1.12
export interface AppServices {
  auth: AuthService
  bots: BotsService
  scan: ScanService
}
