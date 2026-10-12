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
    files: world.filesService
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
