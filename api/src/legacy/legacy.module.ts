import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuthService } from '../auth/application/auth.service'
import { BotsModule } from '../bots/bots.module'
import { BotsService } from '../bots/application/bots.service'
import { ScanService } from '../bots/application/scan.service'
import { AppServices, LEGACY_SERVICES } from './legacy-services'

// Hands the use cases to the legacy Express routers until they are migrated (task 1.12)
@Module({
  imports: [AuthModule, BotsModule],
  providers: [
    {
      provide: LEGACY_SERVICES,
      inject: [AuthService, BotsService, ScanService],
      useFactory: (auth: AuthService, bots: BotsService, scan: ScanService): AppServices => ({ auth, bots, scan })
    }
  ],
  exports: [LEGACY_SERVICES]
})
export class LegacyModule {}
