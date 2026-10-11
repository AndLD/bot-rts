import { Location } from '../../../../lib/utils/interfaces/map'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { GameModule } from './game-module'

// The tunable numbers of combat (design §12.6)
export interface CombatBalance {
  // Every hit does at least this much, however strong the armor
  minDamage: number
  // Share of the accuracy lost at the maximum distance
  accuracyFalloff: number
}

export const DEFAULT_COMBAT_BALANCE: CombatBalance = { minDamage: 1, accuracyFalloff: 0.5 }

// A shot the weapon is able to fire now, with what it costs and what it leaves behind
export interface Shot {
  rounds: number
  hitChance: number
  energyCost: number
  patch: Record<string, unknown>
}

// Distance in cells, the same square metric as the scanner
export function distanceBetween(a: Location, b: Location): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export class WeaponModule extends GameModule {
  get damage(): number {
    return this.number('damage', 0)
  }

  get distance(): number {
    return this.number('distance', 0)
  }

  // Chance to hit at point-blank range, 0..1
  get accuracy(): number {
    return Math.min(this.number('accuracy', 0), 1)
  }

  // Cooldown between shots in ms
  get cooldown(): number {
    return this.number('cooldown', 0)
  }

  // The kind of ammunition it takes from the storage
  get caliber(): number {
    return this.number('caliber', 0)
  }

  // Rounds fired at once
  get batchSize(): number {
    return Math.max(this.number('batchSize', 1), 1)
  }

  // Cooldown after a batch of more than one round, in ms
  get batchCooldown(): number {
    return this.number('batchCooldown', this.cooldown)
  }

  // Fires along a hinged trajectory, not blocked on the way, and splashes the 8 neighbours
  get isArtillery(): boolean {
    return this.flag('isArtillery', false)
  }

  // Rounds the weapon holds when loaded, and how many it holds now
  get magazine(): number {
    return this.number('magazine', 0)
  }

  get loaded(): number {
    return Math.min(this.number('loaded', 0), this.magazine)
  }

  // When the next shot is allowed, in ms of the game clock
  get readyAt(): number {
    return this.number('readyAt', 0)
  }

  // Points the weapon at a cell: the distance to it, if it is in reach
  aim(from: Location, target: Location): Result<number> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    const distance = distanceBetween(from, target)
    if (distance === 0) {
      return fail(ResultCode.OUT_OF_RANGE, 'The weapon cannot target its own cell')
    }
    return distance > this.distance ? fail(ResultCode.OUT_OF_RANGE, 'The target is out of reach') : ok(distance)
  }

  // The chance to hit a cell `distance` away: the accuracy, falling off towards the maximum distance
  hitChance(distance: number, balance: CombatBalance = DEFAULT_COMBAT_BALANCE): number {
    if (this.distance === 0) {
      return 0
    }
    return Math.max(this.accuracy * (1 - balance.accuracyFalloff * (distance / this.distance)), 0)
  }

  // Fires a batch at a cell when the weapon is in reach, off cooldown, loaded and the bot can pay for it
  shoot(
    request: { from: Location; target: Location; now: number; energy: number },
    balance: CombatBalance = DEFAULT_COMBAT_BALANCE
  ): Result<Shot> {
    const aimed = this.aim(request.from, request.target)
    if (!aimed.ok) {
      return aimed
    }
    if (request.now < this.readyAt) {
      return fail(ResultCode.COOLDOWN, 'The weapon is cooling down')
    }
    if (this.loaded <= 0) {
      return fail(ResultCode.NO_AMMO, 'The weapon is empty: reload it')
    }
    const rounds = Math.min(this.batchSize, this.loaded)
    const energyCost = this.record.operationCost * rounds
    if (request.energy < energyCost) {
      return fail(ResultCode.NO_ENERGY, 'Not enough energy to shoot')
    }
    return ok({
      rounds,
      hitChance: this.hitChance(aimed.data, balance),
      energyCost,
      patch: { loaded: this.loaded - rounds, readyAt: request.now + (rounds > 1 ? this.batchCooldown : this.cooldown) }
    })
  }

  // How many rounds of a shot hit, rolling once per round with numbers in [0, 1)
  resolve(shot: Shot, roll: () => number): number {
    let hits = 0
    for (let round = 0; round < shot.rounds; round++) {
      if (roll() < shot.hitChance) {
        hits++
      }
    }
    return hits
  }

  // The condition a hit takes off a module of a target with `armor` protection
  damageAgainst(armor: number, balance: CombatBalance = DEFAULT_COMBAT_BALANCE): number {
    return Math.max(balance.minDamage, this.damage - armor)
  }

  // Loads rounds from the ammunition that is at hand; the patch is what the weapon keeps afterwards
  reload(available: number): Result<{ taken: number; patch: Record<string, unknown> }> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    const room = this.magazine - this.loaded
    if (room <= 0) {
      return ok({ taken: 0, patch: {} })
    }
    if (available <= 0) {
      return fail(ResultCode.NO_AMMO, 'There is no ammunition to load')
    }
    const taken = Math.min(room, available)
    return ok({ taken, patch: { loaded: this.loaded + taken } })
  }
}
