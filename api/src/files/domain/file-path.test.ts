import { FILE_KIND } from '../../../../lib/utils/interfaces/files'
import { ValidationError } from '../../shared/domain/errors'
import { isDirectChild, MAX_PATH_DEPTH, MAX_SEGMENT_LENGTH, parentOf, parsePath } from './file-path'

describe('parsePath', () => {
  it('normalises slashes and accepts the allowed extensions', () => {
    expect(parsePath('/scripts//mine.js/', FILE_KIND.FILE)).toBe('scripts/mine.js')
    for (const name of ['a.js', 'a.ts', 'a.json', 'a.txt', 'a.b.txt', '9-x_y.js']) {
      expect(parsePath(name, FILE_KIND.FILE)).toBe(name)
    }
  })

  it('accepts a directory under any valid name', () => {
    expect(parsePath('data/v1.2', FILE_KIND.DIRECTORY)).toBe('data/v1.2')
  })

  it.each([
    ['', 'empty'],
    ['/', 'empty'],
    ['a.exe', 'extension'],
    ['noextension', 'extension'],
    ['.js', 'a bare extension'],
    ['a/../b.js', 'parent segment'],
    ['./a.js', 'current segment'],
    ['a b.js', 'space'],
    ['a\\b.js', 'backslash'],
    ['.hidden.js', 'dot start'],
    ['ünï.js', 'non-ascii'],
    [`${'x'.repeat(MAX_SEGMENT_LENGTH)}.js`, 'long segment'],
    [`${Array(MAX_PATH_DEPTH).fill('d').join('/')}/f.js`, 'deep path']
  ])('refuses %p (%s)', (path) => {
    expect(() => parsePath(path, FILE_KIND.FILE)).toThrow(ValidationError)
  })
})

describe('parentOf and isDirectChild', () => {
  it('finds the parent directory, null for the root', () => {
    expect(parentOf('a/b/c.js')).toBe('a/b')
    expect(parentOf('c.js')).toBeNull()
  })

  it('tells the direct children of a directory', () => {
    expect(isDirectChild('a/b.js', 'a')).toBe(true)
    expect(isDirectChild('a/b/c.js', 'a')).toBe(false)
    expect(isDirectChild('a.js', null)).toBe(true)
    expect(isDirectChild('a/b.js', null)).toBe(false)
  })
})
