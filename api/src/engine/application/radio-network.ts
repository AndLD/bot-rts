import { KnownPoint } from '../../map/domain/map-point.entity'
import { WirelessAdapterModule } from '../../modules/domain/game-module'
import { isCorpse } from '../../bots/domain/base-state'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { Clock } from '../../shared/application/clock'
import { AppError } from '../../shared/domain/app-error'
import { ResultCode } from '../../../../lib/utils/result'
import { BotLink, Bars, connectivity, NOT_CONNECTED, RadioBalance, RadioNode } from '../domain/radio'
import { GameEvent } from '../domain/game-event'
import { EventOutbox } from './event-outbox'
import { EngineSink } from './engine-ports'
import { RadioBuffers } from './radio-buffers'
import { World, WorldBot } from './world/world'
import { WorldSource } from './world/world-source'

export class NoSignalError extends AppError {
  constructor() {
    super(409, ResultCode.NO_SIGNAL, 'The bot has no radio link to its base')
  }
}

// How a client or a script sees the link of a bot
export interface LinkStatus {
  isConnected: boolean
  signal: Bars
  hops: number
  weakestLink?: { botId: string; margin: number }
  // The game time the link was lost at, while it is lost
  lostSince?: number
}

interface PlayerNetwork {
  rootId: string | null
  links: Map<string, BotLink>
  // Bots out of reach, and since when (ms of the game clock)
  lostSince: Map<string, number>
}

// A change of the signal of one bot, as clients get it: only what changed
export interface RadioChange {
  botId: string
  isConnected: boolean
  bars: Bars
  hops: number
}

// The radio network of every player with bots in memory (design §11.2.1): who is connected to the base, through which chain, and
// how strongly. It does not poll: the world tells when a bot moved or its adapter or energy changed, and only the networks of the
// players concerned are computed again, on the next tick.
export class RadioNetwork {
  private networks = new Map<string, PlayerNetwork>()
  private readonly dirty = new Set<string>()

  constructor(
    private readonly world: World,
    private readonly source: Pick<WorldSource, 'botIdsOfUser'>,
    private readonly sink: EngineSink,
    private readonly outbox: EventOutbox,
    private readonly buffers: RadioBuffers,
    private readonly balance: RadioBalance,
    // Applies the cells a bot saw while out of reach to the player's knowledge, keeping the newer sighting of each cell
    private readonly knowledge: { learn(userId: string, points: KnownPoint[]): Promise<void> },
    private readonly clock: Clock
  ) {
    world.onBotChange((userId) => this.dirty.add(userId))
    world.onEvict((ownerId) => {
      for (const userId of ownerId ? [ownerId] : this.networks.keys()) {
        this.dirty.add(userId)
      }
    })
  }

  // Whether the bot reaches its base, and how well; the network is computed now if it is not up to date
  async statusOf(userId: string, botId: string): Promise<LinkStatus> {
    const network = await this.networkOf(userId)
    const link = network.links.get(botId) ?? NOT_CONNECTED
    const lostSince = network.lostSince.get(botId)
    return {
      isConnected: link.isConnected,
      signal: link.bars,
      hops: link.hops,
      ...(link.weakest ? { weakestLink: link.weakest } : {}),
      ...(!link.isConnected && lostSince !== undefined ? { lostSince } : {})
    }
  }

  // Control of a bot (the terminal, manual commands) needs its link. A bot that is not one of the player's, or a base, is not
  // judged here: the use cases refuse those themselves.
  async ensureControl(userId: string, botId: string): Promise<void> {
    const network = await this.networkOf(userId)
    if (network.lostSince.has(botId)) {
      throw new NoSignalError()
    }
  }

  isConnectedNow(userId: string, botId: string): boolean {
    const network = this.networks.get(userId)
    return !network || !network.lostSince.has(botId)
  }

  // Once per tick after the commands: computes again the networks that changed and reports what changed in them
  async refresh(): Promise<void> {
    for (const userId of [...this.dirty].sort()) {
      this.dirty.delete(userId)
      await this.recompute(userId)
    }
  }

  private async networkOf(userId: string): Promise<PlayerNetwork> {
    if (this.dirty.has(userId) || !this.networks.has(userId)) {
      this.dirty.delete(userId)
      await this.recompute(userId)
    }
    return this.networks.get(userId) as PlayerNetwork
  }

  private async recompute(userId: string): Promise<void> {
    const now = this.clock.now().getTime()
    const before = this.networks.get(userId)
    const members: WorldBot[] = []
    for (const id of await this.source.botIdsOfUser(userId)) {
      const bot = await this.world.bot(id)
      if (bot) {
        members.push(bot)
      }
    }
    const root = members.find((bot) => bot.state.bot.type === BOT_TYPE.BASE && !isCorpse(this.world.modulesOf(bot)))
    const family = root ? members.filter((bot) => bot === root || bot.state.bot.baseId === root.state.bot.id) : []
    const nodes = family.flatMap((bot) => this.nodeOf(bot))
    const links = root ? connectivity(root.state.bot.id, nodes, this.balance) : new Map<string, BotLink>()

    const lostSince = new Map<string, number>()
    const changes: RadioChange[] = []
    for (const bot of family) {
      const id = bot.state.bot.id
      const link = links.get(id) ?? NOT_CONNECTED
      // A bot that was out of reach is not in the links, but it was a member
      const previous = before?.links.get(id) ?? (before?.lostSince.has(id) ? NOT_CONNECTED : undefined)
      if (!link.isConnected) {
        lostSince.set(id, before?.lostSince.get(id) ?? now)
      }
      if (before && previous && (previous.isConnected !== link.isConnected || previous.bars !== link.bars)) {
        changes.push({ botId: id, isConnected: link.isConnected, bars: link.bars, hops: link.hops })
        await this.report(userId, id, previous, link, now)
      }
    }
    this.networks.set(userId, { rootId: root?.state.bot.id ?? null, links, lostSince })
    if (changes.length) {
      this.sink.emit({ type: 'radio', userId, changes })
    }
  }

  // A bot's adapter must work and be switched on, and the bot needs energy, to be part of the network
  private nodeOf(bot: WorldBot): RadioNode[] {
    const adapter = this.world
      .modulesOf(bot)
      .find((module): module is WirelessAdapterModule => module instanceof WirelessAdapterModule && module.isOnline)
    return adapter && bot.position && this.world.energyOf(bot) > 0
      ? [{ botId: bot.state.bot.id, position: bot.position, range: adapter.range }]
      : []
  }

  private async report(userId: string, botId: string, before: BotLink, after: BotLink, now: number): Promise<void> {
    const parties: GameEvent['parties'] = [{ userId, botId }]
    if (before.isConnected && !after.isConnected) {
      this.outbox.publish({ type: 'LinkLost', at: now, parties })
    } else if (!before.isConnected && after.isConnected) {
      this.outbox.publish(await this.restoredEvent(userId, botId, now))
    } else if (after.isConnected && after.bars === 1 && before.bars > 1) {
      this.outbox.publish({ type: 'LinkWeak', at: now, parties, bars: after.bars })
    }
  }

  // The link is back: what the bot saw meanwhile reaches the player's map with its original times, and the events it missed
  // arrive as one summary
  private async restoredEvent(userId: string, botId: string, now: number): Promise<GameEvent> {
    const { scans, events } = this.buffers.take(botId)
    await this.knowledge.learn(userId, scans)
    const byType: Record<string, number> = {}
    for (const event of events) {
      byType[event.type] = (byType[event.type] ?? 0) + 1
    }
    return {
      type: 'LinkRestored',
      at: now,
      parties: [{ userId, botId }],
      missed: { scans: scans.length, events: events.length, byType }
    }
  }
}
