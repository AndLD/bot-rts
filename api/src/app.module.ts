import { DynamicModule, Module } from '@nestjs/common'
import { AppConfig } from './config/app-config'
import { ConfigModule } from './config/config.module'
import { AdminModule } from './admin/admin.module'
import { AchievementsModule } from './achievements/achievements.module'
import { InspectorModule } from './inspector/inspector.module'
import { SupervisionModule } from './supervision/supervision.module'
import { PlayersModule } from './players/players.module'
import { PlayerNotificationsModule } from './player-notifications/player-notifications.module'
import { AuthModule } from './auth/auth.module'
import { BotsModule } from './bots/bots.module'
import { CraftingModule } from './crafting/crafting.module'
import { EngineModule } from './engine/engine.module'
import { RealtimeModule } from './engine/realtime.module'
import { FilesModule } from './files/files.module'
import { HealthModule } from './health/health.module'
import { TimeModule } from './time/time.module'
import { MapModule } from './map/map.module'
import { MapViewModule } from './mapview/mapview.module'
import { ModulesModule } from './modules/modules.module'
import { NotificationsModule } from './notifications/notifications.module'
import { RedisModule } from './redis/redis.module'
import { RateLimitModule } from './ratelimit/ratelimit.module'
import { MetricsModule } from './metrics/metrics.module'
import { MonitoringModule } from './monitoring/monitoring.module'
import { LifecycleModule } from './lifecycle/lifecycle.module'
import { PersistenceModule } from './persistence/persistence.module'
import { TerminalModule } from './terminal/terminal.module'
import { SettingsModule } from './settings/settings.module'
import { TutorialModule } from './tutorial/tutorial.module'
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
        RedisModule,
        RateLimitModule,
        PersistenceModule,
        NotificationsModule,
        UsersModule,
        AuthModule,
        AdminModule,
        PlayersModule,
        InspectorModule,
        SupervisionModule,
        ModulesModule,
        CraftingModule,
        FilesModule,
        MapModule,
        BotsModule,
        MapViewModule,
        SettingsModule,
        TutorialModule,
        AchievementsModule,
        PlayerNotificationsModule,
        TerminalModule,
        EngineModule,
        RealtimeModule,
        HealthModule,
        MetricsModule,
        MonitoringModule,
        LifecycleModule,
        TimeModule
      ]
    }
  }
}
