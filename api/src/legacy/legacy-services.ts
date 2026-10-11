import { BotsService } from '../bots/application/bots.service'
import { ScanService } from '../bots/application/scan.service'
import { MapService } from '../map/application/map.service'
import { UsersService } from '../users/application/users.service'
import { VerificationMailer } from '../users/application/verification-mailer'

export const LEGACY_SERVICES = Symbol('LegacyServices')

// The use cases the legacy Express routers need; removed together with them in task 1.12
export interface AppServices {
  users: UsersService
  bots: BotsService
  scan: ScanService
  mapService: MapService
  verificationMailer: VerificationMailer
}
