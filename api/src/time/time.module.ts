import { Module } from '@nestjs/common'
import { DEFAULT_GAME_TIME } from '../../../lib/utils/game-time'
import { CLOCK, Clock } from '../shared/application/clock'
import { GameTimeService } from './application/game-time.service'
import { GameTimeController } from './presentation/game-time.controller'

@Module({
  controllers: [GameTimeController],
  providers: [
    {
      provide: GameTimeService,
      inject: [CLOCK],
      useFactory: (clock: Clock) => new GameTimeService(clock, DEFAULT_GAME_TIME)
    }
  ]
})
export class TimeModule {}
