import { csvCell, csvRow, toCsv } from './csv'

describe('csv', () => {
  it('writes empty cells for nothing, text as it is, and other values as JSON', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"')
    expect(csvCell(5)).toBe('5')
  })

  it('quotes what needs it, and makes what looks like a formula plain text', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('writes a row, and a header with rows', () => {
    expect(csvRow(['a', 1, null])).toBe('a,1,')
    expect(toCsv(['x', 'y'], [[1, 2]])).toBe('x,y\n1,2\n')
  })
})
