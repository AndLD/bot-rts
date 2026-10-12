import { createWorld } from '../../../tests/fakes/world'
import { ScanService } from '../../bots/application/scan.service'
import { isWorldAction, WORLD_ACTION_NAMES } from './world-actions'
import { WorldActionExecutor } from './world-action-executor'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

async function setup() {
  const world = createWorld()
  const scans = new ScanService(
    world.botsService,
    world.repositories.modules,
    world.repositories.map,
    world.mapService,
    world.moduleRegistry,
    world.clock,
    world.energyService
  )
  const executor = new WorldActionExecutor({
    bots: world.botsService,
    scans,
    factory: world.factoryService,
    assembly: world.assemblyService,
    maintenance: world.maintenanceService,
    files: world.filesService,
    access: world.botAccessService
  })
  return { ...world, executor }
}

describe('WorldActionExecutor', () => {
  it('runs a use case by its action name with the arguments it was sent', async () => {
    const { executor, repositories, filesService } = await setup()

    const deployed = (await executor.execute('bots.deployUserBase', [
      alice,
      { password: 'secret1', location: { x: 5, y: 5, z: 0 } }
    ])) as { bot: { id: string } }
    const botId = deployed.bot.id
    const [drive] = await filesService.listDrives(alice.id, botId)
    const file = await executor.execute('files.write', [alice.id, botId, drive.id, 'a.js', 'x'])

    expect(repositories.bots.items.has(botId)).toBe(true)
    expect(file).toMatchObject({ path: 'a.js', size: 1 })
  })

  it('passes on the failure of a use case', async () => {
    const { executor } = await setup()

    await expect(executor.execute('scan.scan', [alice.id, 'missing'])).rejects.toMatchObject({ statusCode: 404 })
  })

  it('runs the access rules: a connection, then the takeover of an ordinary bot', async () => {
    const { executor, botsService, moduleFactory } = await setup()
    const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }
    const mine = await botsService.deployUserBase(alice, { password: 'secret1', location: { x: 5, y: 5, z: 0 } })
    const theirs = await botsService.deployUserBase(bob, { password: 'bobpw1', location: { x: 8, y: 5, z: 0 } })
    const victim = await botsService.createBot(bob.id, {
      baseId: theirs.bot.id,
      label: 'V',
      modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1'].map((n) => moduleFactory.template(n))
    })

    const connection = await executor.execute('access.connect', [alice.id, mine.bot.id, victim.bot.id, 'bobpw1'])
    const adopted = await executor.execute('access.adopt', [alice.id, mine.bot.id, victim.bot.id])

    expect(connection).toMatchObject({ isForeign: true })
    expect(adopted).toMatchObject({ id: victim.bot.id, baseId: mine.bot.id })
  })

  it('refuses a name that is not an action', async () => {
    const { executor } = await setup()

    expect(() => executor.execute('bots.deleteEverything', [])).toThrow('Unknown action')
    expect(() => executor.execute('constructor', [])).toThrow('Unknown action')
  })

  it('knows its action names', () => {
    expect(Object.keys(WORLD_ACTION_NAMES)).toContain('factory.craft')
    expect(isWorldAction('factory.craft')).toBe(true)
    expect(isWorldAction('toString')).toBe(false)
    expect(isWorldAction(5)).toBe(false)
  })
})
