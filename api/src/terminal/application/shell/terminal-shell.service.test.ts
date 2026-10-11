import { TERMINAL_COMMANDS } from '../../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../../tests/fakes/world'
import { INITIAL_BASE_MODULES } from '../../../modules/domain/initial-base-modules'
import { buildModule } from '../../../../tests/integration/builders'
import { ForbiddenError } from '../../../shared/domain/errors'
import { TOP } from './cwd'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

async function setup() {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice)
  const drive = buildModule(bot.id, { type: 'drive', name: 'memory-class1', props: { quota: 100 } })
  await world.repositories.modules.addMany([drive])
  const session = await world.terminalService.open(alice.id, bot.id)

  // Keeps the place between lines, as the gateway does
  let cwd = TOP
  const run = async (line: string) => {
    const reply = await world.terminalShell.execute(alice.id, session.id, line, cwd)
    cwd = reply.cwd
    return reply.response
  }
  const lines = async (line: string) => {
    const { result } = await run(line)
    return result.type === 'output' ? result.lines : result
  }
  return { ...world, bot, drive, session, run, lines, place: () => cwd }
}

describe('the commands of the base terminal', () => {
  it('knows every command of the reference', async () => {
    const { run } = await setup()

    for (const { name } of TERMINAL_COMMANDS) {
      const { result } = await run(name)
      expect(result).not.toMatchObject({ code: 'UNKNOWN_COMMAND' })
    }
  })

  it('answers help with the whole reference', async () => {
    const { run } = await setup()

    const { result } = await run('help')

    expect(result).toEqual({ type: 'help', commands: TERMINAL_COMMANDS.map((c) => ({ name: c.name, usage: c.usage })) })
  })

  it('asks the client to clear the screen and to leave', async () => {
    const { run } = await setup()

    expect((await run('clear')).result).toEqual({ type: 'clear' })
    expect((await run('exit')).result).toEqual({ type: 'exit' })
  })

  it('lists the bots of the player, marking the current one, and the modules of this bot', async () => {
    const { lines, bot } = await setup()

    expect(await lines('list')).toEqual([`(current) id="${bot.id}" label="Alice base" type="base"`])
    const modules = (await lines('modules')) as string[]
    expect(modules).toHaveLength(8)
    expect(modules).toContainEqual(expect.stringContaining('type="scanner" name="scanner-class1"'))
  })

  it('answers an unknown command and ignores an empty line, the first one unrecorded', async () => {
    const { run, terminalService, bot } = await setup()

    expect((await run('frobnicate now')).result).toMatchObject({
      type: 'error',
      code: 'UNKNOWN_COMMAND',
      message: 'Unknown command: frobnicate'
    })
    expect((await run('   ')).result).toEqual({ type: 'output', lines: [] })
    expect((await terminalService.history(alice.id, bot.id, 10)).map((e) => [e.kind, e.text])).toEqual([
      ['input', 'frobnicate now'],
      ['error', 'Unknown command: frobnicate']
    ])
  })
})

describe('the file commands', () => {
  it('starts at the top, lists the drives and moves into one', async () => {
    const { lines, run, place, drive } = await setup()

    expect(await lines('ls')).toEqual(['memory-class1  0/100 B'])
    expect((await run('cd memory-class1')).cwd).toEqual({ drive: 'memory-class1', directory: null })
    expect(place()).toEqual({ driveId: drive.id, directory: null })
    expect((await run('cd ..')).cwd).toEqual({ drive: null, directory: null })
    expect((await run('cd memory-class1')).cwd.drive).toBe('memory-class1')
    expect((await run('cd')).cwd.drive).toBeNull()
  })

  it('creates directories, writes and reads files, and lists them', async () => {
    const { run, lines, place } = await setup()
    await run('cd memory-class1')

    expect(await lines('mkdir scripts')).toEqual([])
    expect((await run('cd scripts')).cwd).toEqual({ drive: 'memory-class1', directory: 'scripts' })
    expect((await run('edit mine.js')).result).toEqual({ type: 'edit', path: 'mine.js', content: '' })
    expect(place().directory).toBe('scripts')

    await expect(lines('ls')).resolves.toEqual([])
    expect(await lines('ls ..')).toEqual(['scripts/'])
    expect(await lines('ls /')).toEqual(['memory-class1  0/100 B'])
  })

  it('saves what the editor sends, shows it with cat and opens it again with its content', async () => {
    const { run, lines, terminalShell, alice: _ignored, ...rest } = { ...(await setup()), alice: 0 }
    void _ignored
    await run('cd memory-class1')
    await run('mkdir scripts')
    await run('cd scripts')

    const file = await terminalShell.saveFile(alice.id, rest.session.id, rest.place(), 'mine.js', 'a\nb')

    expect(file).toMatchObject({ path: 'scripts/mine.js', size: 3 })
    expect(await lines('cat mine.js')).toEqual(['a', 'b'])
    expect(await lines('ls')).toEqual(['mine.js  3 B'])
    expect((await run('edit mine.js')).result).toEqual({ type: 'edit', path: 'mine.js', content: 'a\nb' })
    expect(await lines('ls ..')).toEqual(['scripts/'])
  })

  it('removes a file, and a directory once it is empty', async () => {
    const { run, lines, terminalShell, session, place } = await setup()
    await run('cd memory-class1')
    await run('mkdir d')
    await terminalShell.saveFile(alice.id, session.id, place(), 'd/x.txt', 'x')

    expect(await lines('rm d')).toMatchObject({ type: 'error', code: 'VALIDATION_FAILED' })
    expect(await lines('rm d/x.txt')).toEqual([])
    expect(await lines('rm d')).toEqual([])
    expect(await lines('rm d')).toMatchObject({ type: 'error', code: 'NOT_FOUND' })
  })

  it('explains what is wrong instead of failing', async () => {
    const { lines, run } = await setup()

    expect(await lines('mkdir a')).toMatchObject({ code: 'NO_DRIVE_SELECTED' })
    expect(await lines('cat a.js')).toMatchObject({ code: 'NO_DRIVE_SELECTED' })
    expect(await lines('edit a.js')).toMatchObject({ code: 'NO_DRIVE_SELECTED' })
    expect(await lines('cd nowhere')).toMatchObject({ code: 'NOT_FOUND', message: 'Unknown path' })

    await run('cd memory-class1')
    expect(await lines('cat')).toMatchObject({ code: 'COMMAND_USAGE', message: 'Usage: cat <file>' })
    expect(await lines('rm a b')).toMatchObject({ code: 'COMMAND_USAGE' })
    expect(await lines('ls a b')).toMatchObject({ code: 'COMMAND_USAGE', message: 'Usage: ls [dir]' })
    expect(await lines('cd a b')).toMatchObject({ code: 'COMMAND_USAGE' })
    expect(await lines('cd missing')).toMatchObject({ code: 'NOT_FOUND' })
    expect(await lines('cat missing.js')).toMatchObject({ code: 'NOT_FOUND' })
    expect(await lines('edit bad.exe')).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('refuses to save without a drive or into a full drive', async () => {
    const { run, terminalShell, session, place } = await setup()

    await expect(terminalShell.saveFile(alice.id, session.id, place(), 'a.js', 'x')).rejects.toMatchObject({
      code: 'NO_DRIVE_SELECTED'
    })
    await run('cd memory-class1')
    await expect(terminalShell.saveFile(alice.id, session.id, place(), 'a.js', 'x'.repeat(101))).rejects.toMatchObject({
      code: 'DRIVE_FULL'
    })
  })

  it('goes back to the top when the drive of the session has gone', async () => {
    const { run, repositories, drive } = await setup()
    await run('cd memory-class1')
    repositories.modules.items.splice(repositories.modules.items.indexOf(drive), 1)

    expect((await run('ls')).cwd).toEqual({ drive: null, directory: null })
  })

  it('lets nobody else run commands in the session', async () => {
    const { terminalShell, session } = await setup()

    await expect(terminalShell.execute('someone-else', session.id, 'ls', TOP)).rejects.toThrow(ForbiddenError)
  })

  it('stores the lines and the output of the commands', async () => {
    const { run, terminalService, bot } = await setup()
    await run('cd memory-class1')
    await run('mkdir d')
    await run('ls')
    await run('cat nope.js')

    const history = (await terminalService.history(alice.id, bot.id, 20)).map((e) => [e.kind, e.text])
    expect(history).toEqual([
      ['input', 'cd memory-class1'],
      ['input', 'mkdir d'],
      ['input', 'ls'],
      ['output', 'd/'],
      ['input', 'cat nope.js'],
      ['error', 'File not found']
    ])
  })

  it('lets an unexpected failure of a command through instead of reporting it as an answer', async () => {
    const { botsService, terminalShell, session } = await setup()
    jest.spyOn(botsService, 'listUserBots').mockRejectedValue(new Error('db down'))

    await expect(terminalShell.execute(alice.id, session.id, 'list', TOP)).rejects.toThrow('db down')
  })

  it('lists a bot without a label by its id and type only', async () => {
    const { run, botsService, bot } = await setup()
    const { bot: worker } = await botsService.createBot(alice.id, {
      baseId: bot.id,
      label: null,
      modules: INITIAL_BASE_MODULES.slice(0, 1)
    })

    const { result } = await run('list')

    expect(result).toMatchObject({ lines: expect.arrayContaining([`- id="${worker.id}" type="worker"`]) })
  })
})
