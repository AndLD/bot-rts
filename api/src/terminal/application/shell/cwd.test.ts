import { NotFoundError } from '../../../shared/domain/errors'
import { pathOnDrive, resolvePlace, TOP } from './cwd'

const drive = (id: string, name: string) => ({ id, botId: 'b', name, quota: 10, used: 0 })
const drives = [drive('d1', 'memory-class1'), drive('d2', 'memory-class2')]

describe('resolvePlace', () => {
  it('selects a drive by name from the top and goes into directories', () => {
    const onDrive = resolvePlace(TOP, drives, 'memory-class2')
    expect(onDrive).toEqual({ driveId: 'd2', directory: null })
    expect(resolvePlace(onDrive, drives, 'a/b')).toEqual({ driveId: 'd2', directory: 'a/b' })
  })

  it('goes up one level at a time, off the drive at its root, and stays at the top', () => {
    const deep = { driveId: 'd1', directory: 'a/b' }
    expect(resolvePlace(deep, drives, '..')).toEqual({ driveId: 'd1', directory: 'a' })
    expect(resolvePlace(deep, drives, '../..')).toEqual({ driveId: 'd1', directory: null })
    expect(resolvePlace(deep, drives, '../../..')).toEqual(TOP)
    expect(resolvePlace(TOP, drives, '..')).toEqual(TOP)
  })

  it('takes an absolute path from the top, and ignores empty and current segments', () => {
    const deep = { driveId: 'd1', directory: 'a' }
    expect(resolvePlace(deep, drives, '/memory-class2/x')).toEqual({ driveId: 'd2', directory: 'x' })
    expect(resolvePlace(deep, drives, '/')).toEqual(TOP)
    expect(resolvePlace(deep, drives, './b//c')).toEqual({ driveId: 'd1', directory: 'a/b/c' })
  })

  it('accepts the old ../drive spelling and refuses an unknown drive', () => {
    expect(resolvePlace({ driveId: 'd1', directory: null }, drives, '../memory-class2')).toEqual({
      driveId: 'd2',
      directory: null
    })
    expect(() => resolvePlace(TOP, drives, 'nope')).toThrow(NotFoundError)
  })

  it('forgets a drive that is no longer there', () => {
    expect(resolvePlace({ driveId: 'gone', directory: 'a' }, drives, '.')).toEqual(TOP)
  })
})

describe('pathOnDrive', () => {
  it('is relative to the current directory unless it starts with a slash', () => {
    expect(pathOnDrive({ driveId: 'd1', directory: 'a' }, 'x.js')).toBe('a/x.js')
    expect(pathOnDrive({ driveId: 'd1', directory: null }, 'x.js')).toBe('x.js')
    expect(pathOnDrive({ driveId: 'd1', directory: 'a' }, '/x.js')).toBe('/x.js')
  })
})
