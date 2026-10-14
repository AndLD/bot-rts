import { FakeUnitOfWork, InMemoryModuleRepository } from '../../../tests/fakes/fakes'
import { buildModule } from '../../../tests/integration/builders'
import { Repositories } from '../../persistence/application/unit-of-work'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { SupportService } from './support.service'

async function setup() {
  const modules = new InMemoryModuleRepository()
  const storage = buildModule('bot', {
    type: 'storage',
    props: { capacity: 10, items: [{ resource: 'iron', amount: 4 }] }
  })
  const damaged = buildModule('bot', { type: 'weapon', condition: 0, maxCondition: 100 })
  await modules.addMany([storage, damaged])

  return {
    modules,
    storage,
    damaged,
    service: new SupportService(new FakeUnitOfWork({ modules } as unknown as Repositories))
  }
}

const stored = (modules: InMemoryModuleRepository, id: string) =>
  (modules.items.find((module) => module.id === id)?.props.items as Array<{ resource: string; amount: number }>) ?? []

describe('SupportService', () => {
  it('grants resources into the storage of a bot', async () => {
    const { service, modules, storage } = await setup()

    await service.grantResources('bot', [
      { resource: 'iron', amount: 3 } as never,
      { resource: 'gold', amount: 2 } as never
    ])

    expect(stored(modules, storage.id)).toEqual([
      { resource: 'iron', amount: 7 },
      { resource: 'gold', amount: 2 }
    ])
  })

  it('grants nothing when it does not fit', async () => {
    const { service, modules, storage } = await setup()

    await expect(service.grantResources('bot', [{ resource: 'iron', amount: 50 } as never])).rejects.toThrow(
      ValidationError
    )

    expect(stored(modules, storage.id)).toEqual([{ resource: 'iron', amount: 4 }])
  })

  it('removes resources, and nothing when there are not enough', async () => {
    const { service, modules, storage } = await setup()

    await service.removeResources('bot', [{ resource: 'iron', amount: 3 } as never])
    expect(stored(modules, storage.id)).toEqual([{ resource: 'iron', amount: 1 }])
    await expect(service.removeResources('bot', [{ resource: 'iron', amount: 9 } as never])).rejects.toThrow(
      ValidationError
    )
    expect(stored(modules, storage.id)).toEqual([{ resource: 'iron', amount: 1 }])
  })

  it('makes a module whole again', async () => {
    const { service, modules, damaged } = await setup()

    await service.restoreModule('bot', damaged.id)

    expect(modules.items.find((module) => module.id === damaged.id)?.condition).toBe(100)
  })

  it('does not know a bot without modules or a module of another bot', async () => {
    const { service } = await setup()

    await expect(service.grantResources('other', [])).rejects.toThrow(NotFoundError)
    await expect(service.removeResources('other', [])).rejects.toThrow(NotFoundError)
    await expect(service.restoreModule('bot', 'missing')).rejects.toThrow(NotFoundError)
  })
})
