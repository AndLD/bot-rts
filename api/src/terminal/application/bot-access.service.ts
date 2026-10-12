import { isValidBotPassword, BOT_PASSWORD_MAX_LENGTH, BOT_PASSWORD_MIN_LENGTH } from '../../../../lib/utils/validation'
import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { PasswordHasher } from '../../auth/application/ports'
import { BotRepository } from '../../bots/application/bot.repository'
import { BotsService } from '../../bots/application/bots.service'
import { BotUnreachableError } from '../../bots/domain/bot.errors'
import { Bot } from '../../bots/domain/bot.entity'
import { RadioNode, linkMargin } from '../../engine/domain/radio'
import { MapRepository } from '../../map/application/map.repository'
import { EnergyService } from '../../modules/application/energy.service'
import { ModuleRepository } from '../../modules/application/module.repository'
import { WirelessAdapterModule } from '../../modules/domain/game-module'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { Clock } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { afterFailure, BotSecurityPolicy, isLockedOut, NO_ATTEMPTS } from '../domain/bot-security'
import { BotLockedError, BotPasswordWrongError, CannotAdoptBaseError } from '../domain/terminal.errors'
import { BotAccessRepository } from './bot-access.repository'
import { SecurityLog } from './session-log-writer'

// The bot a connection reached, and whether it belongs to someone else
export interface Connection {
  readonly bot: Bot
  readonly isForeign: boolean
}

// Passwords, connections to bots of other players, and takeovers (design §11.2.2)
export class BotAccessService {
  constructor(
    private readonly bots: BotsService,
    private readonly botRepository: BotRepository,
    private readonly modules: ModuleRepository,
    private readonly map: MapRepository,
    private readonly registry: ModuleRegistry,
    private readonly energy: EnergyService,
    private readonly hasher: PasswordHasher,
    private readonly access: BotAccessRepository,
    private readonly securityLog: SecurityLog,
    private readonly clock: Clock,
    private readonly policy: BotSecurityPolicy
  ) {}

  // Sets or changes the access password of one of the player's bots
  async setPassword(userId: string, botId: string, password: string): Promise<void> {
    await this.bots.getControlledBot(userId, botId)
    if (!isValidBotPassword(password)) {
      throw new ValidationError(
        `The password must have ${BOT_PASSWORD_MIN_LENGTH}-${BOT_PASSWORD_MAX_LENGTH} characters`
      )
    }
    await this.botRepository.setPasswordHash(botId, await this.hasher.hash(password))
    await this.securityLog.record(botId, userId, 'The access password was changed')
  }

  // Lets a bot of the player connect to another bot. The player's own bots need only a working adapter; a bot of someone else
  // must be within radio range of the one the connection comes from, not locked out, and the password must be right. Every
  // attempt on a foreign bot costs the source bot energy.
  async connect(userId: string, fromBotId: string, targetId: string, password?: string): Promise<Connection> {
    const source = await this.bots.getControlledBot(userId, fromBotId)
    const target = await this.botRepository.findById(targetId)
    if (!target) {
      throw new BotUnreachableError()
    }
    const ownerId = await this.bots.ownerOf(target)
    if (ownerId === userId) {
      return { bot: await this.bots.getReachableBot(userId, targetId), isForeign: false }
    }
    if (!(await this.bots.isReachable(target)) || !(await this.isInRange(source, target))) {
      throw new BotUnreachableError()
    }

    const now = this.clock.now()
    const state = (await this.access.find(target.id)) ?? NO_ATTEMPTS
    if (isLockedOut(state, now)) {
      throw new BotLockedError()
    }
    await this.energy.pay(source.id, this.policy.attemptEnergy)

    const isRight = target.passwordHash === null || (await this.hasher.verify(password ?? '', target.passwordHash))
    if (!isRight) {
      const failed = afterFailure(state, now, this.policy)
      await this.access.save(target.id, failed)
      await this.securityLog.record(
        target.id,
        ownerId ?? userId,
        `Wrong password from bot ${source.id}${failed.lockedUntil ? `; locked out until ${failed.lockedUntil.toISOString()}` : ''}`
      )
      throw new BotPasswordWrongError()
    }
    await this.access.save(target.id, NO_ATTEMPTS)
    await this.securityLog.record(target.id, ownerId ?? userId, `Connected from bot ${source.id}`)
    return { bot: target, isForeign: true }
  }

  // Takes a bot of someone else, authenticated from one of the player's bots, into the base of that bot. A base cannot be taken.
  async adopt(userId: string, fromBotId: string, targetId: string): Promise<Bot> {
    const source = await this.bots.getControlledBot(userId, fromBotId)
    const target = await this.botRepository.findById(targetId)
    if (!target) {
      throw new BotUnreachableError()
    }
    if (target.type === BOT_TYPE.BASE) {
      throw new CannotAdoptBaseError()
    }
    const previousOwner = await this.bots.ownerOf(target)
    if (previousOwner === userId) {
      throw new ValidationError('The bot is already yours')
    }
    const baseId = source.type === BOT_TYPE.BASE ? source.id : (source.baseId as string)
    await this.botRepository.setBase(target.id, baseId)
    await this.securityLog.record(target.id, userId, `Adopted by base ${baseId}`)
    return { ...target, baseId }
  }

  private async isInRange(source: Bot, target: Bot): Promise<boolean> {
    const [from, to] = await Promise.all([this.nodeOf(source), this.nodeOf(target)])
    return from !== null && to !== null && linkMargin(from, to) !== null
  }

  private async nodeOf(bot: Bot): Promise<RadioNode | null> {
    const adapter = this.registry
      .instantiateAll(await this.modules.listOfBot(bot.id))
      .find((module): module is WirelessAdapterModule => module instanceof WirelessAdapterModule && module.isOnline)
    const point = await this.map.findPointByContentId(bot.id)
    return adapter && point ? { botId: bot.id, position: point.location, range: adapter.range } : null
  }
}
