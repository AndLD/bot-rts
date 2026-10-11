import { EventEmitter } from 'events'
import { Socket } from 'socket.io'
import { createWorld } from '../../../tests/fakes/world'
import { buildUser } from '../../../tests/integration/builders'
import { Logger } from '../../shared/application/logger'
import { FactoryGateway } from './factory.gateway'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

async function setup(userId = alice.id) {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: 'secret1',
    location: { x: 5, y: 5, z: 0 }
  })
  const index = world.repositories.modules.items.findIndex((m) => m.type === 'storage')
  const storage = world.repositories.modules.items[index]
  world.repositories.modules.items[index] = {
    ...storage,
    props: {
      capacity: 2000,
      items: [
        { resource: 'iron', amount: 500 },
        { resource: 'crystal', amount: 100 },
        { resource: 'gold', amount: 100 }
      ]
    }
  }
  const logger: jest.Mocked<Logger> = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const gateway = new FactoryGateway(world.factoryService, world.assemblyService, logger)
  const socket = Object.assign(new EventEmitter(), { principal: { user: buildUser({ id: userId }) } })
  gateway.handleConnection(socket as unknown as Socket)
  const call = (event: string, ...args: unknown[]) =>
    new Promise<unknown[]>((resolve) => {
      socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack))
    })
  const advance = (ms: number) => (world.clock.current = new Date(world.clock.now().getTime() + ms))
  return { ...world, base, call, advance, logger }
}

describe('FactoryGateway', () => {
  it('crafts, shows the factory and assembles a bot', async () => {
    const { base, call, advance } = await setup()

    const [jobs] = (await call('craft-module', base.id, 'processor-class1')) as [{ kind: string }[]]
    expect(jobs).toEqual([expect.objectContaining({ kind: 'craft', module: 'processor-class1' })])
    await call('craft-module', base.id, 'wireless-adapter-class1', 1)
    await call('craft-module', base.id, 'battery-class1', undefined)
    advance(100_000)

    const [status] = (await call('get-factory', base.id)) as [
      { parts: { _id: string; name: string }[]; jobs: unknown[] }
    ]
    expect(status.jobs).toEqual([])
    expect(status.parts.map((part) => part.name).sort()).toEqual([
      'battery-class1',
      'processor-class1',
      'wireless-adapter-class1'
    ])

    const [assembled] = (await call(
      'assemble-bot',
      base.id,
      'Scout',
      status.parts.map((part) => part._id)
    )) as [{ bot: { label: string }; modules: unknown[] }]
    expect(assembled.bot.label).toBe('Scout')
    expect(assembled.modules).toHaveLength(3)
    expect((await call('assemble-bot', base.id, null, ['0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e']))[1]).toMatchObject({
      code: 404
    })
  })

  it('researches and learns', async () => {
    const { base, call, repositories } = await setup()

    const [job] = (await call('research-module', base.id, 'scanner-class2')) as [{ kind: string }]
    expect(job.kind).toBe('research')

    await repositories.items.add({
      id: '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e',
      type: 'blueprint' as never,
      name: 'gun-class2',
      weight: 0,
      botId: base.id
    })
    const [blueprint] = (await call('learn-blueprint', base.id, '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e')) as [
      { module: string }
    ]
    expect(blueprint).toMatchObject({ module: 'gun-class2', source: 'item' })
    expect(blueprint).not.toHaveProperty('learnedAt')
  })

  it('validates the payloads and answers errors as acknowledgements', async () => {
    const { base, call } = await setup()
    const bad = { code: 400 }

    expect((await call('get-factory', 'nope'))[1]).toMatchObject({ code: 400, msg: 'Invalid id' })
    expect((await call('craft-module', 'nope', 'x'))[1]).toMatchObject(bad)
    expect((await call('craft-module', base.id, 5))[1]).toMatchObject(bad)
    expect((await call('craft-module', base.id, 'x'.repeat(100)))[1]).toMatchObject(bad)
    expect((await call('craft-module', base.id, 'wheels-class1', 'two'))[1]).toMatchObject(bad)
    expect((await call('craft-module', base.id, 'wheels-class1', 1.5))[1]).toMatchObject(bad)
    expect((await call('craft-module', base.id, 'wheels-class1', 1000))[1]).toMatchObject(bad)
    expect((await call('research-module', base.id, 5))[1]).toMatchObject(bad)
    expect((await call('learn-blueprint', base.id, 'nope'))[1]).toMatchObject(bad)
    expect((await call('assemble-bot', base.id, 5, []))[1]).toMatchObject(bad)
    expect(
      (await call('assemble-bot', base.id, 'x'.repeat(100), ['0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e']))[1]
    ).toMatchObject(bad)
    expect((await call('assemble-bot', base.id, null, []))[1]).toMatchObject(bad)
    expect(
      (await call('assemble-bot', base.id, null, Array(60).fill('0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e')))[1]
    ).toMatchObject(bad)
    expect((await call('assemble-bot', base.id, null, ['nope']))[1]).toMatchObject(bad)
  })

  it('does not let a stranger in and reports expected failures with their codes', async () => {
    const { base, call } = await setup(bob.id)

    expect((await call('craft-module', base.id, 'wheels-class1'))[1]).toMatchObject({ code: 403 })
    expect((await call('get-factory', base.id))[1]).toMatchObject({ code: 403 })

    const owner = await setup()
    expect((await owner.call('craft-module', owner.base.id, 'scanner-class2'))[1]).toMatchObject({ code: 409 })
  })
})
