import { botsService } from '../../services/bots'
import { mapService } from '../../services/map'
import { IScannerModule, IScannerModuleProps, ModuleType } from '@lib/utils/interfaces/modules'
import Module from './Module'

export default class ScannerModule extends Module implements IScannerModule {
  type: ModuleType = 'scanner'
  distance!: number
  delay!: number

  constructor(props: IScannerModuleProps) {
    super(props)
  }

  async scan() {
    if (!this.botId) {
      throw new Error('Missing botId')
    }

    const userId = await botsService.getUserIdByBotId(this.botId)
    if (!userId) {
      throw new Error('UserId not found')
    }

    // Get current bot location
    const botLocation = await mapService.getLocationByContentIdAndType(this.botId.toString())
    if (!botLocation) {
      throw new Error('Bot location not found')
    }

    // Calculate scanning range
    const from = { x: botLocation.x - this.distance, y: botLocation.y - this.distance }
    const to = { x: botLocation.x + this.distance, y: botLocation.y + this.distance }

    // Get user map points
    const userPoints = await mapService.getMap(from, to, userId)

    return userPoints
  }
}
