import { driveNames } from './drive'

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
