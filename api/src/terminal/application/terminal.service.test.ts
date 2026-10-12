import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../tests/fakes/world'
import { NoSignalError } from '../../engine/application/radio-network'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { TerminalService } from './terminal.service'
import { TerminalSessionClosedError } from '../domain/terminal.errors'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }
const DAY_MS = 24 * 3600 * 1000

async function setup(retention = {}) {
  const world = createWorld({ retention })
  const { bot } = await world.botsService.deployUserBase(alice, { password: PASSWORD })
  return { ...world, bot }
}

describe('TerminalService sessions', () => {
  it('stores a session on an own bot, keeps its lines and closes it', async () => {
    const { terminalService, terminalSessions, bot, clock } = await setup()

    const session = await terminalService.open(alice.id, bot.id)
    expect(session).toMatchObject({ botId: bot.id, userId: alice.id, startedAt: clock.current, endedAt: null })

    await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.INPUT, 'ls')
    await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.OUTPUT, 'main.js')
    expect((await terminalService.history(alice.id, bot.id, 10)).map((e) => [e.kind, e.text])).toEqual([
      ['input', 'ls'],
      ['output', 'main.js']
    ])

    clock.current = new Date(clock.current.getTime() + 1000)
    const closed = await terminalService.close(alice.id, session.id)
    expect(closed.endedAt).toEqual(clock.current)
    expect(terminalSessions.sessions.get(session.id)?.endedAt).toEqual(clock.current)
  })

  it('does not open a session on a bot that is out of reach of its base', async () => {
    const { botsService, ids, clock, terminalSessions, moduleFactory, bot } = await setup()
    const { bot: rover } = await botsService.createBot(alice.id, {
      baseId: bot.id,
      label: 'Rover',
      modules: [moduleFactory.template('processor-class1'), moduleFactory.template('wireless-adapter-class1')]
    })
    const gate = { ensureConnected: jest.fn().mockRejectedValue(new NoSignalError()) }
    const service = new TerminalService(
      terminalSessions,
      botsService,
      ids,
      clock,
      { logDays: 30, maxLinesPerBot: 5000, securityDays: 90 },
      gate
    )

    await expect(service.open(alice.id, rover.id)).rejects.toMatchObject({ statusCode: 409, code: 'NO_SIGNAL' })
    expect(gate.ensureConnected).toHaveBeenCalledWith(alice.id, rover.id)
  })

  it('does not open a session on a bot whose wireless adapter is broken', async () => {
    const { terminalService, botsService, moduleFactory, bot, repositories } = await setup()
    const { bot: worker } = await botsService.createBot(alice.id, {
      baseId: bot.id,
      label: null,
      modules: [moduleFactory.template('processor-class1'), moduleFactory.template('wireless-adapter-class1')]
    })
    const adapter = repositories.modules.items.find((m) => m.botId === worker.id && m.type === 'wirelessAdapter')!
    const index = repositories.modules.items.indexOf(adapter)
    repositories.modules.items[index] = { ...adapter, condition: 0 }

    await expect(terminalService.open(alice.id, worker.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'NO_SIGNAL'
    })

    repositories.modules.items[index] = adapter
    await expect(terminalService.open(alice.id, worker.id)).resolves.toMatchObject({ botId: worker.id })
  })

  it('returns the newest lines of the history', async () => {
    const { terminalService, bot } = await setup()
    const session = await terminalService.open(alice.id, bot.id)
    for (const text of ['a', 'b', 'c']) {
      await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.OUTPUT, text)
    }

    expect((await terminalService.history(alice.id, bot.id, 2)).map((e) => e.text)).toEqual(['b', 'c'])
  })

  it('refuses foreign bots, unknown, foreign and closed sessions', async () => {
    const { terminalService, bot } = await setup()
    await expect(terminalService.open(bob.id, bot.id)).rejects.toThrow(ForbiddenError)
    await expect(terminalService.history(bob.id, bot.id, 5)).rejects.toThrow(ForbiddenError)

    const session = await terminalService.open(alice.id, bot.id)
    await expect(terminalService.record(bob.id, session.id, TERMINAL_LOG_KIND.INPUT, 'x')).rejects.toThrow(
      ForbiddenError
    )
    await expect(terminalService.close(alice.id, 'missing')).rejects.toThrow(NotFoundError)

    await terminalService.close(alice.id, session.id)
    await expect(terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.INPUT, 'x')).rejects.toThrow(
      TerminalSessionClosedError
    )
    await expect(terminalService.close(alice.id, session.id)).rejects.toThrow(TerminalSessionClosedError)
  })
})

describe('TerminalService retention', () => {
  it('keeps at most the configured number of ordinary lines per bot, security events aside', async () => {
    const { terminalService, bot, clock } = await setup({ maxLinesPerBot: 2 })
    const session = await terminalService.open(alice.id, bot.id)

    await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.SECURITY, 'failed password')
    for (const text of ['a', 'b', 'c']) {
      clock.current = new Date(clock.current.getTime() + 1)
      await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.OUTPUT, text)
    }

    expect((await terminalService.history(alice.id, bot.id, 10)).map((e) => e.text)).toEqual([
      'failed password',
      'b',
      'c'
    ])
  })

  it('drops expired lines when a session opens, security events later than ordinary lines', async () => {
    const { terminalService, bot, clock } = await setup({ logDays: 30, securityDays: 90 })
    const session = await terminalService.open(alice.id, bot.id)
    await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.OUTPUT, 'old output')
    await terminalService.record(alice.id, session.id, TERMINAL_LOG_KIND.SECURITY, 'old alarm')

    clock.current = new Date(clock.current.getTime() + 31 * DAY_MS)
    await terminalService.open(alice.id, bot.id)
    expect((await terminalService.history(alice.id, bot.id, 10)).map((e) => e.text)).toEqual(['old alarm'])

    clock.current = new Date(clock.current.getTime() + 60 * DAY_MS)
    await terminalService.open(alice.id, bot.id)
    expect(await terminalService.history(alice.id, bot.id, 10)).toEqual([])
  })
})
