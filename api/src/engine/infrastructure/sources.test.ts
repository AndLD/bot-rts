import { createWorld } from '../../../tests/fakes/world'
import { FilesScriptSource } from './files-script.source'
import { ServiceBotStateSource } from './bot-state.source'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

async function setup() {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: 'secret1',
    location: { x: 5, y: 5, z: 0 }
  })
  const { bot: worker } = await world.botsService.createBot(alice.id, {
    baseId: base.id,
    label: 'Worker',
    modules: [world.moduleFactory.template('processor-class1'), world.moduleFactory.template('wireless-adapter-class1')]
  })
  const source = new ServiceBotStateSource(world.botsService, world.repositories.bots, world.repositories.modules)
  return { ...world, base, worker, source }
}

describe('ServiceBotStateSource', () => {
  it('loads a base and a worker with their modules and the owner of the base', async () => {
    const { source, base, worker } = await setup()

    const loadedBase = await source.load(base.id)
    const loadedWorker = await source.load(worker.id)

    expect(loadedBase).toMatchObject({ bot: { id: base.id }, ownerId: alice.id })
    expect(loadedBase?.modules.length).toBeGreaterThan(5)
    expect(loadedWorker).toMatchObject({ bot: { id: worker.id }, ownerId: alice.id })
    expect(loadedWorker?.modules.map((module) => module.type).sort()).toEqual(['processor', 'wirelessAdapter'])
  })

  it('has nothing for a bot that does not exist, or one whose base is gone', async () => {
    const { source, repositories, worker } = await setup()
    expect(await source.load('missing')).toBeNull()

    repositories.bots.items.delete(worker.baseId as string)
    expect(await source.load(worker.id)).toBeNull()
  })

  it('loads a bot of the player that controls it, and refuses anybody else', async () => {
    const { source, worker } = await setup()

    await expect(source.loadControlled(alice.id, worker.id)).resolves.toMatchObject({ ownerId: alice.id })
    await expect(source.loadControlled(bob.id, worker.id)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('FilesScriptSource', () => {
  it('reads a script by /<drive>/<path>', async () => {
    const world = createWorld()
    const { bot } = await world.botsService.deployUserBase(alice, {
      password: 'secret1',
      location: { x: 1, y: 1, z: 0 }
    })
    const [drive] = await world.filesService.listDrives(alice.id, bot.id)
    await world.filesService.write(alice.id, bot.id, drive.id, 'main.js', 'export function main() {}')
    const source = new FilesScriptSource(world.filesService)

    await expect(source.read(alice.id, bot.id, `/${drive.name}/main.js`)).resolves.toBe('export function main() {}')
    await expect(source.read(alice.id, bot.id, `/${drive.name}/other.js`)).rejects.toMatchObject({ statusCode: 404 })
    await expect(source.read(alice.id, bot.id, 'main.js')).rejects.toMatchObject({ statusCode: 404 })
  })
})
