import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { createWorld } from '../../../tests/fakes/world'
import { customiseDrive, removeDrives } from '../../../tests/fakes/drives'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { AlreadyExistsError, DriveBrokenError, DriveFullError } from '../domain/file.errors'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

async function setup(driveOverrides = {}) {
  const world = createWorld()
  const { bot } = await world.botsService.deployUserBase(alice, { password: PASSWORD })
  const drive = customiseDrive(world.repositories.modules, bot.id, { props: { quota: 20 }, ...driveOverrides })
  const call = {
    write: (path: string, content = 'x', userId = alice.id) =>
      world.filesService.write(userId, bot.id, drive.id, path, content),
    read: (path: string) => world.filesService.read(alice.id, bot.id, drive.id, path),
    list: (directory?: string) => world.filesService.list(alice.id, bot.id, drive.id, directory),
    mkdir: (path: string) => world.filesService.makeDirectory(alice.id, bot.id, drive.id, path),
    rm: (path: string) => world.filesService.remove(alice.id, bot.id, drive.id, path)
  }
  return { ...world, bot, drive, call }
}

describe('FilesService drives', () => {
  it('lists the memory modules with their quota and usage', async () => {
    const { filesService, bot, drive, call } = await setup()
    await call.write('a.txt', '12345')

    expect(await filesService.listDrives(alice.id, bot.id)).toEqual([
      { id: drive.id, botId: bot.id, name: 'memory-class1', quota: 20, used: 5 }
    ])
  })

  it('has no drive for a bot without a memory module', async () => {
    const world = createWorld()
    const { bot } = await world.botsService.deployUserBase(alice, { password: PASSWORD })
    removeDrives(world.repositories.modules, bot.id)

    expect(await world.filesService.listDrives(alice.id, bot.id)).toEqual([])
    await expect(world.filesService.list(alice.id, bot.id, 'no-drive')).rejects.toThrow(NotFoundError)
  })

  it('keeps foreign players out and refuses a module that is not a drive', async () => {
    const { filesService, bot, repositories, call } = await setup()
    const [scanner] = (await repositories.modules.listOfBot(bot.id)).filter((m) => m.type === 'scanner')

    await expect(filesService.listDrives(bob.id, bot.id)).rejects.toThrow(ForbiddenError)
    await expect(call.write('a.js', 'x', bob.id)).rejects.toThrow(ForbiddenError)
    await expect(filesService.list(alice.id, bot.id, scanner.id)).rejects.toThrow(NotFoundError)
  })

  it('makes a broken drive inaccessible but keeps it listed', async () => {
    const { filesService, bot, call } = await setup({ condition: 0 })

    expect(await filesService.listDrives(alice.id, bot.id)).toHaveLength(1)
    await expect(call.list()).rejects.toThrow(DriveBrokenError)
    await expect(call.write('a.js')).rejects.toThrow(DriveBrokenError)
  })
})

describe('FilesService files', () => {
  it('writes, reads, overwrites and removes a file', async () => {
    const { call } = await setup()

    const created = await call.write('main.js', 'hello')
    expect(created).toMatchObject({ path: 'main.js', kind: FILE_KIND.FILE, size: 5 })
    expect(await call.read('main.js')).toEqual(created)

    const overwritten = await call.write('/main.js', 'hi')
    expect(overwritten).toMatchObject({ id: created.id, size: 2 })
    expect((await call.read('main.js')).content).toBe('hi')

    await call.rm('main.js')
    await expect(call.read('main.js')).rejects.toThrow(NotFoundError)
    await expect(call.rm('main.js')).rejects.toThrow(NotFoundError)
  })

  it('counts bytes, not characters, against the quota, and frees the old content on overwrite', async () => {
    const { call } = await setup()

    await call.write('a.txt', 'é'.repeat(8))
    await expect(call.write('b.txt', 'x'.repeat(5))).rejects.toThrow(DriveFullError)
    await call.write('a.txt', 'é'.repeat(10))
    await expect(call.write('b.txt', 'x')).rejects.toThrow(DriveFullError)
    await call.write('b.txt', '')
  })

  it('validates names and refuses to overwrite a directory with a file', async () => {
    const { call } = await setup()
    await call.mkdir('dir.js')

    await expect(call.write('bad name.js')).rejects.toThrow(ValidationError)
    await expect(call.write('dir.js')).rejects.toThrow(AlreadyExistsError)
  })

  it('reads only files and refuses an unknown path', async () => {
    const { call } = await setup()
    await call.mkdir('dir')

    await expect(call.read('dir.js')).rejects.toThrow(NotFoundError)
    await call.mkdir('dir2.js')
    await expect(call.read('dir2.js')).rejects.toThrow(NotFoundError)
  })
})

describe('FilesService directories', () => {
  it('needs the parent to exist, then lists direct children only', async () => {
    const { call } = await setup()

    await expect(call.mkdir('a/b')).rejects.toThrow(NotFoundError)
    await expect(call.write('a/x.js')).rejects.toThrow(NotFoundError)
    await call.mkdir('a')
    await call.mkdir('a/b')
    await call.write('a/x.js')
    await call.write('root.js')

    expect((await call.list()).map((f) => f.path)).toEqual(['a', 'root.js'])
    expect((await call.list('a')).map((f) => f.path)).toEqual(['a/b', 'a/x.js'])
    await expect(call.list('missing')).rejects.toThrow(NotFoundError)
    await expect(call.list('root.js')).rejects.toThrow(NotFoundError)
  })

  it('refuses a directory that exists and removes a directory only when empty', async () => {
    const { call } = await setup()
    await call.mkdir('a')
    await call.write('a/x.js')

    await expect(call.mkdir('a')).rejects.toThrow(AlreadyExistsError)
    await expect(call.rm('a')).rejects.toThrow(ValidationError)
    await call.rm('a/x.js')
    await call.rm('a')
    expect(await call.list()).toEqual([])
  })
})
