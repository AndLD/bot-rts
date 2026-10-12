import { DynamicModule, Module } from '@nestjs/common'
import { AppConfig } from './config/app-config'
import { ConfigModule } from './config/config.module'
import { AuthModule } from './auth/auth.module'
import { BotsModule } from './bots/bots.module'
import { CraftingModule } from './crafting/crafting.module'
import { EngineModule } from './engine/engine.module'
import { RealtimeModule } from './engine/realtime.module'
import { FilesModule } from './files/files.module'
import { HealthModule } from './health/health.module'
import { MapModule } from './map/map.module'
import { MapViewModule } from './mapview/mapview.module'
import { ModulesModule } from './modules/modules.module'
import { NotificationsModule } from './notifications/notifications.module'
import { PersistenceModule } from './persistence/persistence.module'
import { TerminalModule } from './terminal/terminal.module'
import { SettingsModule } from './settings/settings.module'
import { SharedModule } from './shared/shared.module'
import { UsersModule } from './users/users.module'

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        SharedModule,
        PersistenceModule,
        NotificationsModule,
        UsersModule,
        AuthModule,
        ModulesModule,
        CraftingModule,
        FilesModule,
        MapModule,
        BotsModule,
        MapViewModule,
        SettingsModule,
        TerminalModule,
        EngineModule,
        RealtimeModule,
        HealthModule
      ]
    }
  }
}
