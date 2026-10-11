import { randomUUID } from 'crypto'
import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { buildBase, buildFile, buildModule, buildUser } from '../../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../../tests/integration/test-database'
import { PrismaBotRepository } from '../../bots/infrastructure/prisma-bot.repository'
import { PrismaModuleRepository } from '../../modules/infrastructure/prisma-module.repository'
import { PrismaUserRepository } from '../../users/infrastructure/prisma-user.repository'
import { PrismaFileRepository } from './prisma-file.repository'

let database: TestDatabase
let files: PrismaFileRepository
let driveId: string

beforeAll(async () => {
  database = await createTestDatabase()
  files = new PrismaFileRepository(database.client)
})
beforeEach(async () => {
  await database.reset()
  const user = buildUser()
  await new PrismaUserRepository(database.client).add(user)
  const base = buildBase(user.id)
  await new PrismaBotRepository(database.client).add(base)
  const drive = buildModule(base.id, { type: 'drive', name: 'drive-class1', props: { readDelay: 10, writeDelay: 20 } })
  await new PrismaModuleRepository(database.client).addMany([drive])
  driveId = drive.id
})
afterAll(() => database.drop())

describe('PrismaFileRepository', () => {
  it('saves, lists, finds and removes the files of a drive', async () => {
    const [b, a] = [buildFile(driveId, { path: 'b.js' }), buildFile(driveId, { path: 'a.js' })]
    const directory = buildFile(driveId, { path: 'dir', kind: FILE_KIND.DIRECTORY, content: '', size: 0 })
    await files.save(b)
    await files.save(a)
    await files.save(directory)

    expect(await files.listOfDrive(driveId)).toEqual([a, b, directory])
    expect(await files.findByPath(driveId, 'a.js')).toEqual(a)
    expect(await files.findByPath(driveId, 'missing.js')).toBeNull()
    expect(await files.listOfDrive(randomUUID())).toEqual([])

    await files.remove(a.id)
    expect(await files.findByPath(driveId, 'a.js')).toBeNull()
  })

  it('replaces the content of a saved file and sums the sizes', async () => {
    const file = buildFile(driveId, { content: 'abc', size: 3 })
    await files.save(file)
    await files.save({ ...file, content: 'abcdef', size: 6 })
    await files.save(buildFile(driveId, { path: 'other.txt', content: 'zz', size: 2 }))

    expect((await files.findByPath(driveId, 'main.js'))?.content).toBe('abcdef')
    expect(await files.usedBytes(driveId)).toBe(8)
    expect(await files.usedBytes(randomUUID())).toBe(0)
  })

  it('keeps paths unique per drive and rejects a directory with content', async () => {
    await files.save(buildFile(driveId, { path: 'a.js' }))

    await expect(files.save(buildFile(driveId, { path: 'a.js' }))).rejects.toThrow()
    await expect(
      files.save(buildFile(driveId, { path: 'd', kind: FILE_KIND.DIRECTORY, content: 'x', size: 1 }))
    ).rejects.toThrow()
  })
})
