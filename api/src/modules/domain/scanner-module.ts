import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { GameModule } from './game-module'

// What a scanner changes in its stored state
export interface ScannerChange {
  patch: Record<string, unknown>
}

export class ScannerModule extends GameModule {
  // Radius in cells
  get distance(): number {
    return this.number('distance', 0)
  }

  // Cooldown in ms
  get delay(): number {
    return this.number('delay', 0)
  }

  // Cells in the square the scanner covers
  get area(): number {
    return (2 * this.distance + 1) ** 2
  }

  // Energy of one look at the whole area: a wider scanner costs more (design §4.2)
  get energyCost(): number {
    return this.record.operationCost * this.area
  }

  // Whether the scanner keeps its area live instead of scanning on demand (design §4.4)
  get isLive(): boolean {
    return this.flag('isLive', false)
  }

  // When the next scan is allowed, in ms of the game clock
  get readyAt(): number {
    return this.number('readyAt', 0)
  }

  // A one-time scan: refused while broken, while the scanner is live and during the cooldown
  scan(now: number): Result<ScannerChange> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (this.isLive) {
      return fail(ResultCode.BUSY, 'The scanner is in live mode')
    }
    if (now < this.readyAt) {
      return fail(ResultCode.COOLDOWN, 'The scanner is cooling down')
    }
    return ok({ patch: { readyAt: now + this.delay } })
  }

  enable(): Result<ScannerChange> {
    const working = this.ensureWorking()
    return working.ok ? ok({ patch: { isLive: true } }) : working
  }

  // Always possible, so that a broken scanner can still be switched off
  disable(): ScannerChange {
    return { patch: { isLive: false } }
  }

  // The live view is read by the engine; the module only says whether there is one
  view(): Result {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    return this.isLive ? ok() : fail(ResultCode.NOT_LIVE, 'The scanner is not live')
  }
}
