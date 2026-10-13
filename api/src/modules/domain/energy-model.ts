import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { BatteryModule, GameModule, GeneratorModule } from './game-module'
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
}

export const DEFAULT_ENERGY_BALANCE: EnergyBalance = { lowThreshold: 0.1 }

// The records of a bot after something happened to its energy
export interface EnergyChange {
  modules: Module[]
  events: EnergyEvent[]
}

// Rounds away the float noise of fractional fuel and energy amounts
const clean = (value: number) => Math.round(value * 1e6) / 1e6

// The energy accounting of one bot (design §12.5): batteries store it, modules drain it, generators burn oil to make it.
// Stateless: it takes the bot's module records and returns the records that changed.
export class EnergyModel {
  constructor(
    private readonly registry: ModuleRegistry,
    private readonly balance: EnergyBalance = DEFAULT_ENERGY_BALANCE
  ) {}

  // The energy in the batteries that are connected and working
  stored(records: readonly Module[]): number {
    return clean(this.batteries(records).reduce((sum, battery) => sum + battery.value, 0))
  }

  capacity(records: readonly Module[]): number {
    return this.batteries(records).reduce((sum, battery) => sum + battery.capacity, 0)
  }

  // A bot with an empty battery performs no operations until energy returns
  isDepleted(records: readonly Module[]): boolean {
    return this.stored(records) <= 0
  }

  // Pays for an operation: the changed records, or NO_ENERGY with the batteries untouched
  spend(records: readonly Module[], amount: number): Result<Module[]> {
    if (amount > this.stored(records)) {
      return fail(ResultCode.NO_ENERGY, 'Not enough energy')
    }
    return ok(this.withdraw(records, amount))
  }

  // One tick, applied after the commands: every working module drains its idle cost, the generators refill the
  // batteries, and a live scanner pays for refreshing its area or switches itself off.
  tick(records: readonly Module[], now: number, ticks = 1): EnergyChange {
    const events: EnergyEvent[] = []
    let current = [...records]

    const idle = this.instances(current)
      .filter((module) => module.isWorking)
      .reduce((sum, module) => sum + module.record.idleCost, 0)
    current = this.withdraw(current, Math.min(idle * ticks, this.stored(current)))

    for (const generator of this.generators(current)) {
      current = this.runGenerator(current, generator.id, now, events)
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

    return { modules: this.reportLow(current, events).filter((record) => !records.includes(record)), events }
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

  private runGenerator(records: readonly Module[], generatorId: string, now: number, events: EnergyEvent[]): Module[] {
    const generator = this.generators(records).find((candidate) => candidate.id === generatorId)
    if (!generator?.isWorking || !generator.isEnabled) {
      return [...records]
    }
    const last = generator.lastCycleAt ?? now
    const due = generator.delay > 0 ? Math.max(Math.floor((now - last) / generator.delay), 0) : 1
    const advanced = generator.delay > 0 ? Math.max(last + due * generator.delay, last) : now
    let current = [...records]

    const room =
      generator.energyPerCycle > 0
        ? Math.ceil((this.capacity(current) - this.stored(current)) / generator.energyPerCycle)
        : 0
    const wanted = Math.min(due, Math.max(room, 0))
    const fuelled =
      generator.fuelPerCycle > 0 ? Math.floor(clean(stockOf(current, RESOURCE.OIL) / generator.fuelPerCycle)) : wanted
    const cycles = Math.min(wanted, fuelled)
    // Out of fuel is a state: it is told when it begins and remembered in the generator until it runs on oil again
    const isStarved = cycles < wanted
    const isOutOfFuel = isStarved || (cycles === 0 && generator.isOutOfFuel)
    current = this.replace(
      current,
      generator.withProps({ lastCycleAt: advanced, ...(isOutOfFuel !== generator.isOutOfFuel && { isOutOfFuel }) })
    )
    if (isStarved && !generator.isOutOfFuel) {
      events.push({ type: ENERGY_EVENT.OUT_OF_FUEL, moduleId: generator.id })
    }
    if (cycles > 0) {
      current = this.apply(
        current,
        withdrawStacks(current, [{ resource: RESOURCE.OIL, amount: clean(cycles * generator.fuelPerCycle) }])
      )
      current = this.deposit(current, cycles * generator.energyPerCycle)
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

  private generators(records: readonly Module[]): GeneratorModule[] {
    return this.instances(records).filter((module): module is GeneratorModule => module instanceof GeneratorModule)
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
