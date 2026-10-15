import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { FileBackupStatusReader } from './file-backup-status.reader'

let directory: string

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'backup-status-'))
})
afterAll(() => rm(directory, { recursive: true, force: true }))

describe('FileBackupStatusReader', () => {
  it('is not configured without a path', async () => {
    expect(await new FileBackupStatusReader(null).read()).toEqual({
      isConfigured: false,
      finishedAt: null,
      sizeBytes: null,
      location: null
    })
  })

  it('reads what the backup job wrote', async () => {
    const path = join(directory, 'full.json')
    await writeFile(path, JSON.stringify({ finishedAt: '2026-10-15T03:00:00Z', sizeBytes: 123, location: 's3://b/x' }))

    expect(await new FileBackupStatusReader(path).read()).toEqual({
      isConfigured: true,
      finishedAt: Date.parse('2026-10-15T03:00:00Z'),
      sizeBytes: 123,
      location: 's3://b/x'
    })
  })

  it('leaves out what the record does not hold or holds wrongly', async () => {
    const path = join(directory, 'partial.json')
    await writeFile(path, JSON.stringify({ finishedAt: 'yesterday', sizeBytes: '12', location: 5 }))

    expect(await new FileBackupStatusReader(path).read()).toEqual({
      isConfigured: true,
      finishedAt: null,
      sizeBytes: null,
      location: null
    })
  })

  it('says the job has not reported when the file is missing or is not a record', async () => {
    const broken = join(directory, 'broken.json')
    await writeFile(broken, 'not json')
    const reported = { isConfigured: true, finishedAt: null, sizeBytes: null, location: null }

    expect(await new FileBackupStatusReader(join(directory, 'missing.json')).read()).toEqual(reported)
    expect(await new FileBackupStatusReader(broken).read()).toEqual(reported)
  })
})
