import { driveNames, splitDrivePath } from './drive'

describe('driveNames', () => {
  it('numbers drives that share a name', () => {
    const drives = [
      { id: 'a', name: 'memory-class1' },
      { id: 'b', name: 'memory-class1' },
      { id: 'c', name: 'memory-class2' }
    ]

    expect([...driveNames(drives).values()]).toEqual(['memory-class1', 'memory-class1-2', 'memory-class2'])
    expect(driveNames(drives).get('b')).toBe('memory-class1-2')
  })
})

describe('splitDrivePath', () => {
  const drives = [{ name: 'memory-class1' }, { name: 'memory-class1-2' }]

  it('splits the drive name from the path on the drive', () => {
    expect(splitDrivePath(drives, '/memory-class1/lib/util.js')).toEqual({ drive: drives[0], path: 'lib/util.js' })
    expect(splitDrivePath(drives, '/memory-class1-2/a')).toEqual({ drive: drives[1], path: 'a' })
  })

  it('refuses relative paths, unknown drives and paths naming no file', () => {
    expect(splitDrivePath(drives, 'memory-class1/a')).toBeNull()
    expect(splitDrivePath(drives, '/other/a')).toBeNull()
    expect(splitDrivePath(drives, '/memory-class1')).toBeNull()
    expect(splitDrivePath(drives, '/memory-class1/')).toBeNull()
    expect(splitDrivePath(drives, '/memory-class1//a')).toBeNull()
  })
})
