import { ItemType } from '../../../../../lib/utils/interfaces/items'
import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { ok } from '../../../../../lib/utils/result'
import { Location } from '../../../map/domain/map-point.entity'
import { ArmorModule } from '../../../modules/domain/game-module'
import { CombatBalance, WeaponModule } from '../../../modules/domain/weapon-module'
import { Clock } from '../../../shared/application/clock'
import { BotState } from '../../domain/bot-state'
import { isNeighbour } from '../../domain/heading'
import { JsonValue } from '../../domain/json-value'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World, WorldBot } from '../world/world'
import { actingPlaced, isFailure } from './acting'

const BLOCKING_TYPES: ReadonlySet<MapPointType | null> = new Set([
  MapPointType.BOT,
  MapPointType.BASE,
  MapPointType.CORPSE_BASE
])

// The cells strictly between two cells on the straight line a shot flies along (Bresenham)
export function lineBetween(from: Location, to: Location): Location[] {
  const cells: Location[] = []
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let error = dx - dy
  let x = from.x
  let y = from.y
  while (x !== to.x || y !== to.y) {
    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += sx
    }
    if (doubled < dx) {
      error += dx
      y += sy
    }
    if (x !== to.x || y !== to.y) {
      cells.push({ x, y, z: from.z })
    }
  }
  return cells
}

// aim, shoot and reload (design §12.6): a shot hits the first bot on its line unless the weapon is artillery; every hit
// damages one random module of the victim. Simultaneous fire is settled by the order the commands of a tick are applied in
// (§12.4), and the rolls come from the tick's seeded generator.
export class CombatHandler implements ScriptFunctionHandler {
  readonly functions = ['aim', 'shoot', 'reload']

  constructor(
    private readonly world: World,
    private readonly clock: Clock,
    private readonly balance: CombatBalance
  ) {}

  async handle(state: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const acting = await actingPlaced(this.world, state)
    if (isFailure(acting)) {
      return acting
    }
    const weapons = acting.modules.filter((module): module is WeaponModule => module instanceof WeaponModule)
    const weapon = weapons.find((module) => module.isWorking) ?? weapons[0]

    if (fn === 'reload') {
      return this.reload(acting.bot, weapon)
    }
    const target: Location = { x: args[0] as number, y: args[1] as number, z: acting.position.z }
    if (fn === 'aim') {
      const aimed = weapon.aim(acting.position, target)
      return aimed.ok ? ok({ distance: aimed.data }) : aimed
    }
    return this.shoot(acting.bot, weapon, acting.position, target)
  }

  private async shoot(bot: WorldBot, weapon: WeaponModule, from: Location, target: Location): Promise<CallOutcome> {
    const shot = weapon.shoot(
      { from, target, now: this.clock.now().getTime(), energy: this.world.energyOf(bot) },
      this.balance
    )
    if (!shot.ok) {
      return shot
    }
    const paid = this.world.spend(bot, shot.data.energyCost)
    if (!paid.ok) {
      return paid
    }
    this.world.updateModules(bot, [weapon.withProps(shot.data.patch)])

    const hits = weapon.resolve(shot.data, () => this.world.random())
    const struck = hits > 0 ? await this.victimOn(from, target, weapon) : null
    if (struck) {
      for (let hit = 0; hit < hits; hit++) {
        await this.damage(struck.botId, weapon.damage)
      }
      if (weapon.isArtillery) {
        await this.splash(struck.location, struck.botId, weapon)
      }
    }
    return ok({
      rounds: shot.data.rounds,
      hits,
      struck: struck ? { x: struck.location.x, y: struck.location.y } : null
    })
  }

  // The bot a shot reaches: the first one on the line, or for artillery the one on the target cell
  private async victimOn(from: Location, target: Location, weapon: WeaponModule) {
    const path = weapon.isArtillery ? [] : lineBetween(from, target)
    for (const location of [...path, target]) {
      const cell = await this.world.cell(location)
      if (BLOCKING_TYPES.has(cell.type) && cell.contentId) {
        return { botId: cell.contentId, location }
      }
    }
    return null
  }

  // Artillery shells hurt the bots on the 8 cells around the impact at half damage, friends included
  private async splash(center: Location, impactBotId: string, weapon: WeaponModule): Promise<void> {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const location = { x: center.x + dx, y: center.y + dy, z: 0 }
        if ((dx || dy) && isNeighbour(center, location)) {
          const cell = await this.world.cell(location)
          if (BLOCKING_TYPES.has(cell.type) && cell.contentId && cell.contentId !== impactBotId) {
            await this.damage(cell.contentId, Math.floor(weapon.damage / 2))
          }
        }
      }
    }
  }

  // The hit lands on one random module of the victim; its armor takes some of the force (design §12.6)
  private async damage(botId: string, force: number): Promise<void> {
    const victim = await this.world.bot(botId)
    if (!victim || !victim.state.modules.length) {
      return
    }
    const protection = this.world
      .modulesOf(victim)
      .filter((module): module is ArmorModule => module instanceof ArmorModule && module.isWorking)
      .reduce((sum, armor) => sum + armor.protection, 0)
    const struck = victim.state.modules[Math.floor(this.world.random() * victim.state.modules.length)]
    const taken = Math.max(this.balance.minDamage, force - protection)
    this.world.updateModules(victim, [{ ...struck, condition: Math.max(struck.condition - taken, 0) }])
  }

  private async reload(bot: WorldBot, weapon: WeaponModule): Promise<CallOutcome> {
    const rounds = bot.carried.filter((item) => item.type === ItemType.AMMUNITION)
    const loaded = weapon.reload(rounds.length)
    if (!loaded.ok) {
      return loaded
    }
    if (loaded.data.taken) {
      const paid = this.world.spend(bot, weapon.record.operationCost)
      if (!paid.ok) {
        return paid
      }
      rounds.slice(0, loaded.data.taken).forEach((item) => this.world.consumeItem(bot, item))
      this.world.updateModules(bot, [weapon.withProps(loaded.data.patch)])
    }
    return ok({ loaded: weapon.loaded + loaded.data.taken })
  }
}
