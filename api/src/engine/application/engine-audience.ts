import { EventAudience } from './game-event-bus'
import { LiveVision } from './live-vision'
import { RadioNetwork } from './radio-network'

// Who can hear what, from the live areas and the radio network
export class EngineAudience implements EventAudience {
  constructor(
    private readonly vision: Pick<LiveVision, 'audienceAt'>,
    private readonly radio: Pick<RadioNetwork, 'isConnectedNow'>
  ) {}

  watchersOf(location: { x: number; y: number; z: number }): string[] {
    return this.vision.audienceAt(location)
  }

  isConnected(userId: string, botId: string): boolean {
    return this.radio.isConnectedNow(userId, botId)
  }
}
