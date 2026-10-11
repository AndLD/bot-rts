import { TERMINAL_COMMANDS } from '../../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../../tests/fakes/world'
import { MODULE_CATALOG } from '../../../modules/domain/module-catalog'
import { customiseDrive } from '../../../../tests/fakes/drives'
import { ForbiddenError } from '../../../shared/domain/errors'
import { RecipeService } from '../../../crafting/application/recipe.service'
import { RecipeBook } from '../../../crafting/domain/recipe-book'
import { InMemoryBlueprintRepository } from '../../../../tests/fakes/fakes'
import { DEFAULT_CRAFTING_BALANCE, DEFAULT_RECIPES } from '../../../../../lib/utils/interfaces/crafting'
import { RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { RecipesCommand } from './commands/factory-commands'
import { DisassembleCommand } from './commands/maintenance-commands'
import { TOP } from './cwd'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

async function setup() {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice, { password: PASSWORD })
  const drive = customiseDrive(world.repositories.modules, bot.id, { props: { quota: 100 } })
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
    expect(modules).toHaveLength(10)
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
      modules: MODULE_CATALOG.slice(0, 1)
    })

    const { result } = await run('list')

    expect(result).toMatchObject({ lines: expect.arrayContaining([`- id="${worker.id}" type="worker"`]) })
  })
})

describe('the factory commands', () => {
  async function withStock() {
    const context = await setup()
    const index = context.repositories.modules.items.findIndex((m) => m.type === 'storage')
    const storage = context.repositories.modules.items[index]
    context.repositories.modules.items[index] = {
      ...storage,
      props: {
        capacity: 2000,
        items: [
          { resource: 'iron', amount: 500 },
          { resource: 'crystal', amount: 300 },
          { resource: 'gold', amount: 100 },
          { resource: 'oil', amount: 50 }
        ]
      }
    }
    const advance = (ms: number) => (context.clock.current = new Date(context.clock.now().getTime() + ms))
    return { ...context, advance }
  }

  it('lists the recipes with what the player may do', async () => {
    const { lines } = await setup()

    const recipes = (await lines('recipes')) as string[]

    expect(recipes).toContain('- module="scanner-class1" known cost="20 iron, 5 crystal" time=10s')
    expect(recipes).toContain('- module="scanner-class2" researchable cost="40 iron, 15 crystal" time=20s')
  })

  it('crafts, waits for the factory and assembles a bot from the parts', async () => {
    const { lines, advance, repositories } = await withStock()

    const queued = (await lines('craft processor-class1')) as string[]
    expect(queued[0]).toMatch(/^queued 1 x processor-class1, the last one is ready at 2026-06-01T12:00:25/)
    await lines('craft wireless-adapter-class1')
    await lines('craft battery-class1')

    expect(await lines('factory')).toEqual(
      [
        'craft module="processor-class1" ready in 25s',
        'craft module="wireless-adapter-class1" ready in 45s',
        'craft module="battery-class1" ready in 60s'
      ].map((line) => `- ${line}`)
    )

    advance(60_000)
    const status = (await lines('factory')) as string[]
    expect(status).toHaveLength(3)
    expect(status[0]).toMatch(/^- part id="[^"]+" module="processor-class1"$/)

    const ids = status.map((line) => /id="([^"]+)"/.exec(line)?.[1] as string)
    const assembled = (await lines(`assemble Scout ${ids.join(' ')}`)) as string[]
    expect(assembled[0]).toMatch(/^assembled bot id="[^"]+" at \d+,\d+$/)
    expect(await lines('factory')).toEqual([])
    expect([...repositories.bots.items.values()].filter((bot) => bot.label === 'Scout')).toHaveLength(1)
  })

  it('researches and learns', async () => {
    const { lines, advance, repositories, bot } = await withStock()

    expect(((await lines('research scanner-class2')) as string[])[0]).toMatch(/^researching scanner-class2, ready at /)
    advance(200_000)
    await lines('factory')
    expect(repositories.blueprints.items.map((b) => b.module)).toEqual(['scanner-class2'])

    await repositories.items.add({ id: 'bp', type: 'blueprint' as never, name: 'gun-class2', weight: 0, botId: bot.id })
    expect(await lines('learn bp')).toEqual(['learned the blueprint of gun-class2'])
  })

  it('reports usage and failures as errors', async () => {
    const { run } = await setup()

    expect((await run('craft')).result).toMatchObject({ type: 'error', code: 'COMMAND_USAGE' })
    expect((await run('craft a 2 3')).result).toMatchObject({ type: 'error', code: 'COMMAND_USAGE' })
    expect((await run('research')).result).toMatchObject({ type: 'error', code: 'COMMAND_USAGE' })
    expect((await run('learn')).result).toMatchObject({ type: 'error', code: 'COMMAND_USAGE' })
    expect((await run('assemble Scout')).result).toMatchObject({ type: 'error', code: 'COMMAND_USAGE' })
    expect((await run('craft wheels-class1')).result).toMatchObject({ type: 'error', code: 'EMPTY' })
    expect((await run('craft wheels-class1 x')).result).toMatchObject({ type: 'error', code: 'VALIDATION_FAILED' })
    expect((await run('craft scanner-class2')).result).toMatchObject({ type: 'error', code: 'NO_BLUEPRINT' })
  })

  it('assembles a bot without a label when the label is a dash', async () => {
    const { lines, advance, repositories } = await withStock()
    for (const module of ['processor-class1', 'wireless-adapter-class1', 'battery-class1']) {
      await lines(`craft ${module}`)
    }
    advance(100_000)
    const ids = ((await lines('factory')) as string[]).map((line) => /id="([^"]+)"/.exec(line)?.[1] as string)

    await lines(`assemble - ${ids.join(' ')}`)

    expect([...repositories.bots.items.values()].some((bot) => bot.type === 'worker' && bot.label === null)).toBe(true)
  })

  it('shows the blueprint items the base holds', async () => {
    const { lines, repositories, bot } = await withStock()
    await repositories.items.add({ id: 'bp', type: 'blueprint' as never, name: 'gun-class2', weight: 0, botId: bot.id })

    expect(await lines('factory')).toEqual(['- blueprint id="bp" module="gun-class2"'])
  })

  it('marks a recipe locked while the class below it is unknown', async () => {
    const recipes = new RecipeService(
      new RecipeBook(
        [
          ...DEFAULT_RECIPES,
          {
            module: 'scanner-class3',
            classLevel: 3,
            resources: [{ resource: RESOURCE.IRON, amount: 1 }],
            craftTimeMs: 1000
          }
        ],
        DEFAULT_CRAFTING_BALANCE
      ),
      new InMemoryBlueprintRepository()
    )

    const { result } = await new RecipesCommand(recipes).execute({ userId: alice.id } as never)

    expect(result).toMatchObject({ type: 'output' })
    expect((result as { lines: string[] }).lines).toContain('- module="scanner-class3" locked cost="1 iron" time=1s')
  })

  it('repairs and disassembles on an adjacent bot, from the terminal of the bot with the repair module', async () => {
    const { botsService, moduleFactory, repositories, terminalService, terminalShell, bot, clock } = await withStock()
    const kit = ['processor-class1', 'wireless-adapter-class1', 'battery-class1', 'storage-class1', 'repair-class1']
    const { bot: medic } = await botsService.createBot(alice.id, {
      baseId: bot.id,
      label: null,
      modules: kit.map((name) => moduleFactory.template(name))
    })
    const storage = repositories.modules.items.find((m) => m.botId === medic.id && m.type === 'storage')!
    repositories.modules.items[repositories.modules.items.indexOf(storage)] = {
      ...storage,
      props: { capacity: 500, items: [{ resource: 'iron', amount: 100 }] }
    }
    const gun = repositories.modules.items.find((m) => m.botId === bot.id && m.type === 'weapon')!
    repositories.modules.items[repositories.modules.items.indexOf(gun)] = { ...gun, condition: 50 }

    const session = await terminalService.open(alice.id, medic.id)
    const run = async (line: string) => (await terminalShell.execute(alice.id, session.id, line, TOP)).response.result

    expect(await run(`repair ${bot.id} ${gun.id}`)).toEqual({
      type: 'output',
      lines: ['repaired gun-class1: condition 75/100']
    })
    clock.current = new Date(clock.now().getTime() + 1000)
    expect(await run(`disassemble ${bot.id} ${gun.id}`)).toEqual({
      type: 'output',
      lines: ['disassembled, scrap: 20 iron']
    })
    expect(repositories.modules.items.some((m) => m.id === gun.id)).toBe(false)
  })

  it('says when the scrap of a disassembly is nothing', async () => {
    const command = new DisassembleCommand({ disassemble: async () => ({ scrap: [], blueprint: null }) } as never)

    const { result } = await command.execute({ userId: alice.id, session: { botId: 'bot' }, args: ['a', 'b'] } as never)

    expect(result).toEqual({ type: 'output', lines: ['disassembled, scrap: nothing'] })
  })

  it('reports the usage of the maintenance commands', async () => {
    const { run } = await setup()

    expect((await run('repair a')).result).toMatchObject({ code: 'COMMAND_USAGE' })
    expect((await run('disassemble a b c')).result).toMatchObject({ code: 'COMMAND_USAGE' })
  })
})
