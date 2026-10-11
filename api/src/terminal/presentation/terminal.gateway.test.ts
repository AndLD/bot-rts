import { EventEmitter } from 'events'
import { Socket } from 'socket.io'
import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../tests/fakes/world'
import { buildModule, buildUser } from '../../../tests/integration/builders'
import { Logger } from '../../shared/application/logger'
import { TerminalGateway } from './terminal.gateway'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

async function setup(userId = alice.id) {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice, { password: PASSWORD })
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const gateway = new TerminalGateway(world.terminalService, world.terminalShell, logger)
  const socket = Object.assign(new EventEmitter(), { principal: { user: buildUser({ id: userId }) } })
  gateway.handleConnection(socket as unknown as Socket)

  const call = (event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack))
    })

  return { ...world, bot, logger, socket, call }
}

async function withDrive() {
  const world = await setup()
  const drive = buildModule(world.bot.id, { type: 'drive', name: 'memory-class1', props: { quota: 100 } })
  await world.repositories.modules.addMany([drive])
  const [session] = (await world.call('open-terminal', world.bot.id)) as [{ _id: string }]
  return { ...world, drive, sessionId: session._id }
}

describe('TerminalGateway', () => {
  it('opens and closes a session and serves the history', async () => {
    const { bot, call, terminalService } = await setup()

    const [session] = (await call('open-terminal', bot.id)) as [{ _id: string; botId: string; endedAt?: number }]
    expect(session).toMatchObject({ botId: bot.id })
    expect(session.endedAt).toBeUndefined()

    await terminalService.record(alice.id, session._id, TERMINAL_LOG_KIND.OUTPUT, 'hello')
    expect(await call('get-terminal-history', bot.id, 5)).toEqual([
      [expect.objectContaining({ sessionId: session._id, kind: 'output', text: 'hello' })]
    ])

    const [closed] = (await call('close-terminal', session._id)) as [{ endedAt?: number }]
    expect(closed.endedAt).toEqual(expect.any(Number))
  })

  it('validates the payloads and answers errors as acknowledgements', async () => {
    const { bot, call } = await setup()

    expect(await call('open-terminal', 'nope')).toEqual([null, { code: 400, msg: 'Invalid id' }])
    expect(await call('close-terminal', 5)).toEqual([null, { code: 400, msg: 'Invalid id' }])
    expect(await call('get-terminal-history', bot.id, 0)).toEqual([null, { code: 400, msg: 'Invalid history request' }])
    expect(await call('get-terminal-history', 'nope', 5)).toEqual([null, { code: 400, msg: 'Invalid history request' }])
  })

  it('does not let a stranger in', async () => {
    const { bot, call } = await setup(bob.id)

    expect((await call('open-terminal', bot.id))[1]).toMatchObject({ code: 403 })
  })

  it('caps the length of the history request', async () => {
    const { bot, call, terminalService } = await setup()
    const history = jest.spyOn(terminalService, 'history')

    await call('get-terminal-history', bot.id, 1_000_000)

    expect(history).toHaveBeenCalledWith(alice.id, bot.id, 1000)
  })

  it('closes the sessions of a socket that disconnects, and logs a failure to do so', async () => {
    const { bot, call, socket, terminalSessions, terminalService, logger } = await setup()
    const [open] = (await call('open-terminal', bot.id)) as [{ _id: string }]
    const [alsoClosed] = (await call('open-terminal', bot.id)) as [{ _id: string }]
    await call('close-terminal', alsoClosed._id)

    socket.emit('disconnect')
    await new Promise((resolve) => setImmediate(resolve))
    expect(terminalSessions.sessions.get(open._id)?.endedAt).not.toBeNull()

    const failing = await setup()
    await failing.call('open-terminal', failing.bot.id)
    jest.spyOn(failing.terminalService, 'close').mockRejectedValue(new Error('db down'))
    failing.socket.emit('disconnect')
    await new Promise((resolve) => setImmediate(resolve))
    expect(failing.logger.error).toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
    expect(terminalService).toBeDefined()
  })

  it('runs commands in the session and keeps the place between them', async () => {
    const { call, sessionId } = await withDrive()

    expect(await call('terminal-command', sessionId, 'cd memory-class1')).toEqual([
      { result: { type: 'output', lines: [] }, cwd: { drive: 'memory-class1', directory: null } }
    ])
    await call('terminal-command', sessionId, 'mkdir scripts')
    const [listing] = (await call('terminal-command', sessionId, 'ls')) as [{ result: { lines: string[] } }]

    expect(listing.result.lines).toEqual(['scripts/'])
  })

  it('saves the file of the editor into the place the session is in', async () => {
    const { call, sessionId } = await withDrive()
    await call('terminal-command', sessionId, 'cd memory-class1')

    const [file] = (await call('save-terminal-file', sessionId, 'main.js', 'run()')) as [{ path: string; size: number }]

    expect(file).toMatchObject({ path: 'main.js', size: 5 })
    expect(file).not.toHaveProperty('content')
  })

  it('validates command and save payloads', async () => {
    const { call, sessionId } = await withDrive()

    expect(await call('terminal-command', 'nope', 'ls')).toEqual([null, { code: 400, msg: 'Invalid command' }])
    expect(await call('terminal-command', sessionId, 5)).toEqual([null, { code: 400, msg: 'Invalid command' }])
    expect(await call('terminal-command', sessionId, 'x'.repeat(2000))).toEqual([
      null,
      { code: 400, msg: 'Invalid command' }
    ])
    expect(await call('save-terminal-file', sessionId, 5, 'x')).toEqual([null, { code: 400, msg: 'Invalid file' }])
    expect(await call('save-terminal-file', sessionId, 'a.js', 5)).toEqual([null, { code: 400, msg: 'Invalid file' }])
  })

  it('drives a session only through the socket that opened it', async () => {
    const { call, bot, terminalService } = await setup()
    const other = await terminalService.open(alice.id, bot.id)

    expect((await call('terminal-command', other.id, 'help'))[1]).toMatchObject({ code: 403 })
    expect((await call('save-terminal-file', other.id, 'a.js', 'x'))[1]).toMatchObject({ code: 403 })
    expect((await call('terminal-command', '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e', 'help'))[1]).toMatchObject({
      code: 403
    })
  })
})
