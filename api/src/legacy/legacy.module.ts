import { Module } from '@nestjs/common'
import { BotsModule } from '../bots/bots.module'
import { BotsService } from '../bots/application/bots.service'
import { ScanService } from '../bots/application/scan.service'
import { MapModule } from '../map/map.module'
import { MapService } from '../map/application/map.service'
import { UsersModule } from '../users/users.module'
import { UsersService } from '../users/application/users.service'
import { VerificationMailer } from '../users/application/verification-mailer'
import { AppServices, LEGACY_SERVICES } from './legacy-services'

// Hands the use cases to the legacy Express routers until they are migrated (task 1.12)
@Module({
  imports: [UsersModule, BotsModule, MapModule],
  providers: [
    {
      provide: LEGACY_SERVICES,
      inject: [UsersService, BotsService, ScanService, MapService, VerificationMailer],
      useFactory: (
        users: UsersService,
        bots: BotsService,
        scan: ScanService,
        mapService: MapService,
        verificationMailer: VerificationMailer
      ): AppServices => ({ users, bots, scan, mapService, verificationMailer })
    }
  ],
  exports: [LEGACY_SERVICES]
})
export class LegacyModule {}
