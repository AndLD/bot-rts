import { randomUUID } from 'crypto'
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
  it('stores, lists and finds files of a drive', async () => {
    const [b, a] = [buildFile(driveId, { name: 'b.js' }), buildFile(driveId, { name: 'a.js' })]
    await files.add(b)
    await files.add(a)

    expect(await files.listOfDrive(driveId)).toEqual([a, b])
    expect(await files.findByName(driveId, 'a.js')).toEqual(a)
    expect(await files.findByName(driveId, 'missing.js')).toBeNull()
    expect(await files.listOfDrive(randomUUID())).toEqual([])
  })

  it('keeps file names unique per drive', async () => {
    await files.add(buildFile(driveId, { name: 'a.js' }))

    await expect(files.add(buildFile(driveId, { name: 'a.js' }))).rejects.toThrow()
  })
})
