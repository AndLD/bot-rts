import { DEFAULT_GAME_TIME, GameTimeConfig } from '../../../../lib/utils/game-time'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { BatteryModule, GameModule, PowerSourceModule } from './game-module'
import { Module } from './module.entity'
import { ModuleRegistry } from './module-registry'
import { ScannerModule } from './scanner-module'
import { stockOf, withdrawStacks } from './storage-stock'

// What happened to a bot's energy that somebody should hear about (design §12.5, §24)
export const ENERGY_EVENT = {
  LOW: 'EnergyLow',
  OUT_OF_FUEL: 'OutOfFuel',
  LIVE_SCAN_STOPPED: 'LiveScanStopped'
} as const

export type EnergyEventType = (typeof ENERGY_EVENT)[keyof typeof ENERGY_EVENT]

export interface EnergyEvent {
  type: EnergyEventType
  // The module the event is about: the generator without oil, the scanner that switched itself off
  moduleId?: string
}

export interface EnergyBalance {
  // Share of the capacity under which the bot is told its energy is low
  lowThreshold: number
  // The stored energy an unpowered bot needs before it powers on again (design §12.5)
  resumeThreshold: number
}

export const DEFAULT_ENERGY_BALANCE: EnergyBalance = { lowThreshold: 0.1, resumeThreshold: 10 }

// The records of a bot after something happened to its energy
export interface EnergyChange {
  modules: Module[]
  events: EnergyEvent[]
}

// Rounds away the float noise of fractional fuel and energy amounts
const clean = (value: number) => Math.round(value * 1e6) / 1e6

// The energy accounting of one bot (design §12.5): batteries store it, modules drain it, power sources make it (generators burn oil, solar panels follow the sun).
// Stateless: it takes the bot's module records and returns the records that changed.
export class EnergyModel {
  constructor(
    private readonly registry: ModuleRegistry,
    private readonly balance: EnergyBalance = DEFAULT_ENERGY_BALANCE,
    private readonly time: GameTimeConfig = DEFAULT_GAME_TIME
  ) {}

  // The energy in the batteries that are connected and working
  stored(records: readonly Module[]): number {
    return clean(this.batteries(records).reduce((sum, battery) => sum + battery.value, 0))
  }

  capacity(records: readonly Module[]): number {
    return this.batteries(records).reduce((sum, battery) => sum + battery.capacity, 0)
  }

  // A bot whose battery reached zero is unpowered: it performs no operations and holds no radio link until the stored energy
  // has grown to the resume threshold
  isDepleted(records: readonly Module[]): boolean {
    return this.stored(records) <= 0 || this.batteries(records).some((battery) => battery.isUnpowered)
  }

  // The energy a bot can use now: nothing while it is unpowered
  available(records: readonly Module[]): number {
    return this.isDepleted(records) ? 0 : this.stored(records)
  }

  // Pays for an operation: the changed records, or NO_ENERGY with the batteries untouched
  spend(records: readonly Module[], amount: number): Result<Module[]> {
    if (amount > this.available(records)) {
      return fail(ResultCode.NO_ENERGY, 'Not enough energy')
    }
    return ok(this.withdraw(records, amount))
  }

  // One tick, applied after the commands: every working module drains its idle cost, the power sources refill the
  // batteries, and a live scanner pays for refreshing its area or switches itself off.
  tick(records: readonly Module[], now: number, ticks = 1): EnergyChange {
    const events: EnergyEvent[] = []
    let current = [...records]

    // An unpowered bot is dark: its modules drain nothing until it powers on again
    const hasReachedZero = this.isDepleted(current)
    const idle = hasReachedZero
      ? 0
      : this.instances(current)
          .filter((module) => module.isWorking)
          .reduce((sum, module) => sum + module.record.idleCost, 0)
    current = this.withdraw(current, Math.min(idle * ticks, this.stored(current)))

    for (const source of this.powerSources(current)) {
      current = this.runPowerSource(current, source.id, now, events)
    }

    for (const scanner of this.instances(current).filter((m): m is ScannerModule => m instanceof ScannerModule)) {
      if (scanner.isWorking && scanner.isLive) {
        const paid = this.spend(current, scanner.energyCost)
        if (paid.ok) {
          current = paid.data
        } else {
          current = this.replace(current, scanner.withProps(scanner.disable().patch))
          events.push({ type: ENERGY_EVENT.LIVE_SCAN_STOPPED, moduleId: scanner.id })
        }
      }
    }

    current = this.updatePower(current, hasReachedZero)
    return { modules: this.reportLow(current, events).filter((record) => !records.includes(record)), events }
  }

  // Remembers in the batteries that the bot ran out of energy, and forgets it once the stored energy is back to the resume
  // threshold: the state survives a restart and is the same for the radio, the operations and the jobs
  private updatePower(records: readonly Module[], wasZero: boolean): Module[] {
    const batteries = this.batteries(records)
    if (batteries.length === 0) {
      return [...records]
    }
    const stored = this.stored(records)
    const isUnpowered = batteries.some((battery) => battery.isUnpowered) || wasZero || stored <= 0
    const resume = Math.min(this.balance.resumeThreshold, this.capacity(records))
    const shouldStay = isUnpowered && stored < resume
    if (shouldStay === batteries.some((battery) => battery.isUnpowered)) {
      return [...records]
    }
    return shouldStay
      ? this.replace(records, batteries[0].withProps({ isUnpowered: true }))
      : batteries
          .filter((battery) => battery.isUnpowered)
          .reduce((current, battery) => this.replace(current, battery.withProps({ isUnpowered: false })), [...records])
  }

  // Says that the energy got low once, and remembers it in the batteries until it is not low any more: the state is told
  // when it begins, not on every tick, and not again after a restart
  private reportLow(records: readonly Module[], events: EnergyEvent[]): Module[] {
    const batteries = this.batteries(records)
    const isLow =
      this.capacity(records) > 0 && this.stored(records) < this.capacity(records) * this.balance.lowThreshold
    const reported = batteries.filter((battery) => battery.isLowReported)
    let current = [...records]

    if (isLow && reported.length === 0) {
      current = this.replace(current, batteries[0].withProps({ isLowReported: true }))
      events.push({ type: ENERGY_EVENT.LOW })
    } else if (!isLow) {
      reported.forEach((battery) => (current = this.replace(current, battery.withProps({ isLowReported: false }))))
    }

    return current
  }

  private runPowerSource(records: readonly Module[], sourceId: string, now: number, events: EnergyEvent[]): Module[] {
    const source = this.powerSources(records).find((candidate) => candidate.id === sourceId)
    if (!source?.isWorking || !source.isEnabled) {
      return [...records]
    }
    const last = source.lastCycleAt ?? now
    const due = source.delay > 0 ? Math.max(Math.floor((now - last) / source.delay), 0) : 1
    const advanced = source.delay > 0 ? Math.max(last + due * source.delay, last) : now
    let current = [...records]

    const perCycle = clean(source.energyPerCycle * source.outputAt(now, this.time))
    const room = perCycle > 0 ? Math.ceil((this.capacity(current) - this.stored(current)) / perCycle) : 0
    const wanted = Math.min(due, Math.max(room, 0))
    const fuelled =
      source.fuelPerCycle > 0 ? Math.floor(clean(stockOf(current, RESOURCE.OIL) / source.fuelPerCycle)) : wanted
    const cycles = Math.min(wanted, fuelled)
    // Out of fuel is a state: it is told when it begins and remembered in the source until it runs on oil again
    const isStarved = cycles < wanted
    const isOutOfFuel = isStarved || (cycles === 0 && source.isOutOfFuel)
    current = this.replace(
      current,
      source.withProps({ lastCycleAt: advanced, ...(isOutOfFuel !== source.isOutOfFuel && { isOutOfFuel }) })
    )
    if (isStarved && !source.isOutOfFuel) {
      events.push({ type: ENERGY_EVENT.OUT_OF_FUEL, moduleId: source.id })
    }
    if (cycles > 0) {
      current = this.apply(
        current,
        withdrawStacks(current, [{ resource: RESOURCE.OIL, amount: clean(cycles * source.fuelPerCycle) }])
      )
      current = this.deposit(current, cycles * perCycle)
    }
    return current
  }

  private instances(records: readonly Module[]): GameModule[] {
    return this.registry.instantiateAll(records)
  }

  private batteries(records: readonly Module[]): BatteryModule[] {
    return this.instances(records).filter(
      (module): module is BatteryModule => module instanceof BatteryModule && module.isWorking && module.isConnected
    )
  }

  private powerSources(records: readonly Module[]): PowerSourceModule[] {
    return this.instances(records).filter((module): module is PowerSourceModule => module instanceof PowerSourceModule)
  }

  // The records with the changed ones of a successful withdrawal put in; the caller has checked there is enough
  private apply(records: readonly Module[], withdrawal: Result<Module[]>): Module[] {
    return withdrawal.ok
      ? withdrawal.data.reduce((current, changed) => this.replace(current, changed), [...records])
      : [...records]
  }

  private replace(records: readonly Module[], changed: Module): Module[] {
    return records.map((record) => (record.id === changed.id ? changed : record))
  }

  // Takes `amount` out of the batteries, one after the other; the caller has checked there is enough
  private withdraw(records: readonly Module[], amount: number): Module[] {
    let left = amount
    let current: Module[] = [...records]
    for (const battery of this.batteries(records)) {
      const taken = Math.min(battery.value, left)
      if (taken > 0) {
        current = this.replace(current, battery.withProps({ value: clean(battery.value - taken) }))
        left = clean(left - taken)
      }
    }
    return current
  }

  // Puts energy into the batteries up to their capacity; what does not fit is lost
  private deposit(records: readonly Module[], amount: number): Module[] {
    let left = amount
    let current: Module[] = [...records]
    for (const battery of this.batteries(records)) {
      const added = Math.min(battery.capacity - battery.value, left)
      if (added > 0) {
        current = this.replace(current, battery.withProps({ value: clean(battery.value + added) }))
        left = clean(left - added)
      }
    }
    return current
  }
}
