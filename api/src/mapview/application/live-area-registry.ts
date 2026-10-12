import { ILiveArea } from '../../../../lib/utils/interfaces/map'
import { EnginePort } from '../../engine/application/engine-port'
import { LiveAreaSource } from './map-view.service'

// Remembers the live areas each player has, as the engine last announced them (design §4.4), so a client that asks for its
// map is told which cells are live. The engine is the owner of the truth; this is a cache that follows its announcements.
export class LiveAreaRegistry implements LiveAreaSource {
  private readonly areas = new Map<string, ILiveArea[]>()
  private off: (() => void) | null = null

  constructor(private readonly engine: Pick<EnginePort, 'onEvent'>) {}

  start(): void {
    this.off = this.engine.onEvent((event) => {
      if (event.type !== 'live-areas') {
        return
      }
      if (event.areas.length) {
        this.areas.set(event.userId, event.areas)
      } else {
        this.areas.delete(event.userId)
      }
    })
  }

  stop(): void {
    this.off?.()
    this.off = null
  }

  areasOf(userId: string): ILiveArea[] {
    return this.areas.get(userId) ?? []
  }
}
