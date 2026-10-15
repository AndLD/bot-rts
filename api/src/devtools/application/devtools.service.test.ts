import { FakeClock } from '../../../tests/fakes/fakes'
import { ValidationError } from '../../shared/domain/errors'
import { DevToolsService } from './devtools.service'

function setup(deploy: (userId: string) => Promise<{ bot: { id: string } }> = async () => ({ bot: { id: 'base' } })) {
  const added: string[] = []
  const erased: string[] = []
  let counter = 0
  const users = new Map<string, { id: string }>()
  const unitOfWork = {
    run: async (work: (repositories: unknown) => Promise<unknown>) =>
      work({
        users: {
          add: async (user: { id: string }) => {
            users.set(user.id, user)
            added.push(user.id)
          },
          findById: async (id: string) => users.get(id) ?? null,
          update: async (user: { id: string }) => void erased.push(user.id)
        },
        identities: { add: async () => undefined, deleteByUserId: async () => undefined },
        credentials: { add: async () => undefined, deleteByUserId: async () => undefined },
        sessions: { deleteByUserId: async () => undefined },
        authTokens: { deleteByUserId: async () => undefined }
      })
  }
  let pending: string[][] = []
  const logger = { warn: jest.fn() }
  const service = new DevToolsService(
    unitOfWork as never,
    { deployUserBase: jest.fn(async (user: { id: string }) => deploy(user.id)) } as never,
    { hash: async (password: string) => `hash:${password}` } as never,
    { activeIds: async () => pending.shift() ?? [] },
    { next: () => `id${String(++counter).padStart(6, '0')}-0000` },
    new FakeClock(),
    logger as never
  )

  return { service, added, erased, logger, queue: (...batches: string[][]) => (pending = batches) }
}

describe('DevToolsService', () => {
  it('creates test players with a derived password and a base', async () => {
    const { service, added } = setup()

    const result = await service.seedWorld(2)

    expect(added).toHaveLength(2)
    expect(result.players[0]).toMatchObject({
      email: 'player-id000001@devtools.test',
      password: 'Dev-id000001-1',
      botPassword: 'bot-id000001',
      baseId: 'base'
    })
    expect(result.after).toEqual({ created: result.players.map(({ userId, baseId }) => ({ userId, baseId })) })
  })

  it('keeps a test player whose base could not be placed, without a base id', async () => {
    const { service, logger } = setup(async () => {
      throw new Error('no free cell')
    })

    const { players } = await service.seedWorld(1)

    expect(players[0].baseId).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no free cell'))
  })

  it.each([0, 21, 1.5])('refuses %p test players', async (count) => {
    await expect(setup().service.seedWorld(count)).rejects.toBeInstanceOf(ValidationError)
  })

  it('erases the test players batch by batch, and skips one that is already gone', async () => {
    const { service, erased, added, queue } = setup()
    await service.seedWorld(1)
    queue([added[0], 'ghost'], [])

    const result = await service.removeTestPlayers()

    expect(result).toMatchObject({ removed: 2, after: { removed: 2 } })
    expect(erased).toEqual([added[0]])
  })
})
