import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../tests/fakes/world'
import { BotUnreachableError } from '../../bots/domain/bot.errors'
import { EnergyModel } from '../../modules/domain/energy-model'
import { ValidationError } from '../../shared/domain/errors'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

async function setup(options: Parameters<typeof createWorld>[0] = {}) {
  const world = createWorld(options)
  const mine = await world.botsService.deployUserBase(alice, { password: 'alicepw', location: { x: 5, y: 5, z: 0 } })
  const theirs = await world.botsService.deployUserBase(bob, { password: 'bobpw1', location: { x: 8, y: 5, z: 0 } })
  const worker = async (owner: typeof alice, baseId: string) =>
    (
      await world.botsService.createBot(owner.id, {
        baseId,
        label: 'Worker',
        modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1'].map((name) =>
          world.moduleFactory.template(name)
        )
      })
    ).bot
  const securityLines = () =>
    world.terminalSessions.logs.filter((entry) => entry.kind === TERMINAL_LOG_KIND.SECURITY).map((entry) => entry.text)
  const connect = (password?: string, target = theirs.bot.id) =>
    world.botAccessService.connect(alice.id, mine.bot.id, target, password)
  const energyOf = async (botId: string) => energyStored(world, botId)
  return { ...world, mine: mine.bot, theirs: theirs.bot, worker, securityLines, connect, energyOf }
}

async function energyStored(world: ReturnType<typeof createWorld>, botId: string) {
  return new EnergyModel(world.moduleRegistry).stored(await world.repositories.modules.listOfBot(botId))
}

describe('BotAccessService passwords', () => {
  it('changes the password of an own bot and leaves a security note', async () => {
    const { botAccessService, mine, repositories, securityLines } = await setup()

    await botAccessService.setPassword(alice.id, mine.id, 'newsecret')

    expect((await repositories.bots.findById(mine.id))?.passwordHash).toBe('hashed:newsecret')
    expect(securityLines()).toEqual(['The access password was changed'])
  })

  it('refuses a short password, and a bot of someone else', async () => {
    const { botAccessService, mine, theirs } = await setup()

    await expect(botAccessService.setPassword(alice.id, mine.id, 'abc')).rejects.toBeInstanceOf(ValidationError)
    await expect(botAccessService.setPassword(alice.id, theirs.id, 'newsecret')).rejects.toMatchObject({
      statusCode: 403
    })
  })
})

describe('BotAccessService connect', () => {
  it('connects own bots without a password and without energy cost', async () => {
    const t = await setup()
    const worker = await t.worker(alice, t.mine.id)
    const before = await t.energyOf(t.mine.id)

    const connection = await t.botAccessService.connect(alice.id, t.mine.id, worker.id)

    expect(connection).toEqual({ bot: worker, isForeign: false })
    expect(await t.energyOf(t.mine.id)).toBe(before)
  })

  it('lets a foreign bot in with its password, which costs energy, and notes it on the bot', async () => {
    const t = await setup()
    const before = await t.energyOf(t.mine.id)

    const connection = await t.connect('bobpw1')

    expect(connection).toMatchObject({ isForeign: true, bot: { id: t.theirs.id } })
    expect(await t.energyOf(t.mine.id)).toBe(before - t.securityPolicy.attemptEnergy)
    expect(t.securityLines()).toEqual([`Connected from bot ${t.mine.id}`])
  })

  it('lets anyone in to a bot without a password', async () => {
    const t = await setup()
    const open = await t.worker(bob, t.theirs.id)
    await t.repositories.bots.items.set(open.id, { ...open, passwordHash: null })

    await expect(t.connect(undefined, open.id)).resolves.toMatchObject({ isForeign: true })
  })

  it('notes a connection to a bot that belongs to nobody under the player who connected', async () => {
    const t = await setup()
    const orphan = await t.worker(bob, t.theirs.id)
    t.repositories.bots.items.set(orphan.id, { ...orphan, baseId: null, passwordHash: null })

    await expect(t.connect(undefined, orphan.id)).resolves.toMatchObject({ isForeign: true })

    expect(t.terminalSessions.sessions.size).toBe(1)
    expect([...t.terminalSessions.sessions.values()][0].userId).toBe(alice.id)
  })

  it('refuses a wrong or missing password, charges for the try and logs it on the target', async () => {
    const t = await setup()
    const before = await t.energyOf(t.mine.id)

    await expect(t.connect('wrong')).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })
    await expect(t.connect()).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })

    expect(await t.energyOf(t.mine.id)).toBe(before - 2 * t.securityPolicy.attemptEnergy)
    expect(t.securityLines()).toEqual([`Wrong password from bot ${t.mine.id}`, `Wrong password from bot ${t.mine.id}`])
  })

  it('locks the bot out after too many failures, for a while, and counts afresh after the lockout', async () => {
    const t = await setup({ security: { maxFailures: 2, lockoutMs: 1000 } })

    await expect(t.connect('x')).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })
    await expect(t.connect('x')).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })
    const before = await t.energyOf(t.mine.id)
    await expect(t.connect('bobpw1')).rejects.toMatchObject({ code: 'BOT_LOCKED', statusCode: 423 })
    expect(await t.energyOf(t.mine.id)).toBe(before)
    expect(t.securityLines().pop()).toMatch(/locked out until/)

    t.clock.current = new Date(t.clock.current.getTime() + 1001)
    await expect(t.connect('bobpw1')).resolves.toMatchObject({ isForeign: true })
  })

  it('forgets earlier failures after a right password', async () => {
    const t = await setup({ security: { maxFailures: 2 } })

    await expect(t.connect('x')).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })
    await t.connect('bobpw1')
    await expect(t.connect('x')).rejects.toMatchObject({ code: 'BOT_PASSWORD_WRONG' })
  })

  it('needs the target within radio range and with a working adapter, and an energy to pay with', async () => {
    const far = await setup()
    const distant = await far.botsService.deployUserBase(
      { id: '33333333-3333-4333-8333-333333333333', name: 'Carol' },
      { password: 'carolpw', location: { x: 500, y: 500, z: 0 } }
    )
    await expect(far.connect('carolpw', distant.bot.id)).rejects.toBeInstanceOf(BotUnreachableError)

    const none = await setup()
    await expect(none.connect('x', '99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(BotUnreachableError)

    const deaf = await setup()
    const adapter = (await deaf.repositories.modules.listOfBot(deaf.theirs.id)).find(
      (m) => m.type === 'wirelessAdapter'
    )!
    deaf.repositories.modules.items[deaf.repositories.modules.items.indexOf(adapter)] = { ...adapter, condition: 0 }
    await expect(deaf.connect('bobpw1')).rejects.toBeInstanceOf(BotUnreachableError)
  })

  it('does not let a player connect from a bot of someone else', async () => {
    const t = await setup()

    await expect(t.botAccessService.connect(alice.id, t.theirs.id, t.mine.id)).rejects.toMatchObject({
      statusCode: 403
    })
  })
})

describe('BotAccessService adopt', () => {
  it('moves a foreign ordinary bot to the base of the connecting bot and notes it', async () => {
    const t = await setup()
    const victim = await t.worker(bob, t.theirs.id)

    const adopted = await t.botAccessService.adopt(alice.id, t.mine.id, victim.id)

    expect(adopted.baseId).toBe(t.mine.id)
    expect((await t.repositories.bots.findById(victim.id))?.baseId).toBe(t.mine.id)
    expect(t.securityLines()).toEqual([`Adopted by base ${t.mine.id}`])
  })

  it('uses the base of the connecting bot when that is an ordinary bot', async () => {
    const t = await setup()
    const scout = await t.worker(alice, t.mine.id)
    const victim = await t.worker(bob, t.theirs.id)

    expect((await t.botAccessService.adopt(alice.id, scout.id, victim.id)).baseId).toBe(t.mine.id)
  })

  it('never adopts a base, a bot that is already yours, or a bot that is gone', async () => {
    const t = await setup()
    const own = await t.worker(alice, t.mine.id)

    await expect(t.botAccessService.adopt(alice.id, t.mine.id, t.theirs.id)).rejects.toMatchObject({
      code: 'CANNOT_ADOPT_BASE'
    })
    await expect(t.botAccessService.adopt(alice.id, t.mine.id, own.id)).rejects.toBeInstanceOf(ValidationError)
    await expect(
      t.botAccessService.adopt(alice.id, t.mine.id, '99999999-9999-4999-8999-999999999999')
    ).rejects.toBeInstanceOf(BotUnreachableError)
  })
})
