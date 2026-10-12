import { ok } from '../../../../../lib/utils/result'
import { SCRIPT_FUNCTIONS } from '../../../../../lib/utils/script-api'
import { MODULE_CATALOG } from '../../../modules/domain/module-catalog'
import { createWorld } from '../../../../tests/fakes/world'
import { ScanService } from '../../../bots/application/scan.service'
import { BotState } from '../../domain/bot-state'
import { CallOutcome, ScriptApi } from '../script-api'
import { DriveHandler } from './drive-handler'
import { FactoryHandler } from './factory-handler'
import { MaintenanceHandler } from './maintenance-handler'
import { ScannerHandler } from './scanner-handler'

const WORLD_FUNCTIONS = SCRIPT_FUNCTIONS.filter((spec) => !spec.isScheduled)
  .map((spec) => spec.name)
  .filter(
    (name) =>
      !['scan', 'craft', 'assemble', 'research', 'learn', 'repair', 'disassemble', 'read', 'write'].includes(name)
  )

const dataOf = <T>(result: CallOutcome): T => {
  if (!result.ok) throw new Error(result.msg)
  return result.data as T
}

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const PASSWORD = 'secret1'

async function setup() {
  const world = createWorld()
  const { bot, modules } = await world.botsService.deployUserBase(alice, {
    password: PASSWORD,
    location: { x: 5, y: 5, z: 0 }
  })
  const api = new ScriptApi([
    new ScannerHandler(
      new ScanService(
        world.botsService,
        world.repositories.modules,
        world.repositories.map,
        world.mapService,
        world.moduleRegistry,
        world.clock,
        world.energyService
      )
    ),
    new FactoryHandler(world.factoryService, world.assemblyService),
    new MaintenanceHandler(world.maintenanceService),
    new DriveHandler(world.filesService),
    // The functions that work on the in-memory world have their own tests
    { functions: WORLD_FUNCTIONS, handle: async () => ok(undefined) }
  ])
  // The starter kit has no GPS; the tests that need one add it
  const gps = world.moduleFactory.create('gps-class1', bot.id)
  await world.repositories.modules.addMany([gps])
  const state: BotState = { bot, ownerId: alice.id, modules: [...modules, gps] }
  const stored = (type: string) => world.repositories.modules.items.find((m) => m.botId === bot.id && m.type === type)!
  return { ...world, api, bot, state, stored }
}

describe('script API handlers', () => {
  it('scan returns the cells around the bot as plain data', async () => {
    const { api, state } = await setup()

    const result = await api.execute(state, 'scan', [])

    expect(result.ok).toBe(true)
    const cells = dataOf<Array<{ x: number; y: number; contentId: string | null }>>(result)
    expect(cells).toHaveLength(9)
    expect(cells.find((cell) => cell.x === 5 && cell.y === 5)?.contentId).toBe(state.bot.id)
  })

  it('scan reports a spent scanner as a failure value', async () => {
    const { api, state } = await setup()
    await api.execute(state, 'scan', [])

    await expect(api.execute(state, 'scan', [])).resolves.toMatchObject({ ok: false, code: 'COOLDOWN' })
  })

  it('craft queues the order and returns the jobs', async () => {
    const { api, state, stored, repositories } = await setup()
    const storage = stored('storage')
    repositories.modules.items[repositories.modules.items.indexOf(storage)] = {
      ...storage,
      props: {
        ...storage.props,
        capacity: 1000,
        items: [
          { resource: 'iron', amount: 200 },
          { resource: 'crystal', amount: 200 }
        ]
      }
    }

    const result = await api.execute(state, 'craft', ['scanner-class1', 2])

    expect(result.ok).toBe(true)
    expect(dataOf<unknown[]>(result)).toHaveLength(2)
  })

  it('craft without resources, or of an unknown module, is a failure value', async () => {
    const { api, state } = await setup()

    await expect(api.execute(state, 'craft', ['scanner-class1'])).resolves.toMatchObject({ ok: false })
    await expect(api.execute(state, 'craft', ['no-such-module'])).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND'
    })
  })

  it('assemble builds a bot from parts, research and learn reach the factory', async () => {
    const { api, state } = await setup()

    await expect(api.execute(state, 'assemble', [null, ['missing-part']])).resolves.toMatchObject({ ok: false })
    await expect(api.execute(state, 'research', ['scanner-class2'])).resolves.toMatchObject({ ok: false })
    await expect(api.execute(state, 'learn', ['missing-item'])).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('assemble returns the id of the new bot', async () => {
    const { api, state, repositories, ids } = await setup()
    const { bot } = state
    const parts = ['processor-class1', 'wireless-adapter-class1', 'battery-class1'].map((name) => ({
      id: ids.next(),
      type: 'part' as const,
      name,
      botId: bot.id,
      userId: null
    }))
    for (const part of parts) {
      await repositories.items.add(part as never)
    }

    const result = await api.execute(state, 'assemble', ['Scout', parts.map((part) => part.id)])

    expect(result).toMatchObject({ ok: true })
    expect(typeof dataOf<{ botId: string }>(result).botId).toBe('string')
  })

  it('read and write use the files of the bot by /<drive>/<path>', async () => {
    const { api, state } = await setup()
    const drive = MODULE_CATALOG.find((template) => template.type === 'drive')!.name

    await expect(api.execute(state, 'write', [`/${drive}/main.js`, 'export function main() {}'])).resolves.toEqual({
      ok: true,
      data: { path: `/${drive}/main.js`, size: 25 }
    })
    await expect(api.execute(state, 'read', [`/${drive}/main.js`])).resolves.toEqual({
      ok: true,
      data: { path: `/${drive}/main.js`, content: 'export function main() {}', size: 25 }
    })
    await expect(api.execute(state, 'read', [`/${drive}/missing.js`])).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND'
    })
    await expect(api.execute(state, 'read', ['/nowhere/main.js'])).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND'
    })
  })

  it('repair and disassemble need a target bot next to the repairer', async () => {
    const { api, state, botsService, moduleFactory } = await setup()
    const { bot: medic, modules } = await botsService.createBot(alice.id, {
      baseId: state.bot.id,
      label: 'Medic',
      modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1', 'repair-class1'].map((name) =>
        moduleFactory.template(name)
      )
    })
    const medicState: BotState = { bot: medic, ownerId: alice.id, modules }

    await expect(api.execute(medicState, 'repair', ['no-bot', 'no-module'])).resolves.toMatchObject({ ok: false })
    await expect(api.execute(medicState, 'disassemble', ['no-bot', 'no-module'])).resolves.toMatchObject({ ok: false })
  })
})
