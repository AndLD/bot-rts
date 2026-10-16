import { formatTraceparent, parseTraceparent } from '../../../../lib/utils/trace-context'

const HEADER = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

describe('parseTraceparent', () => {
  it('reads the ids and the sampled flag', () => {
    expect(parseTraceparent(HEADER)).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      isSampled: true
    })
    expect(parseTraceparent(HEADER.replace(/01$/, '00'))?.isSampled).toBe(false)
    expect(parseTraceparent(` ${HEADER.toUpperCase()} `)?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  })

  it.each([
    undefined,
    null,
    '',
    'garbage',
    '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`,
    `00-4bf92f3577b34da6a3ce929d0e0e4736-${'0'.repeat(16)}-01`,
    '00-4bf92f3577b34da6a3ce929d0e0e47-00f067aa0ba902b7-01'
  ])('is not a context: %p', (value) => {
    expect(parseTraceparent(value)).toBeUndefined()
  })
})

describe('formatTraceparent', () => {
  it('writes what parseTraceparent reads', () => {
    expect(formatTraceparent(parseTraceparent(HEADER)!)).toBe(HEADER)
    expect(formatTraceparent({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), isSampled: false })).toBe(
      `00-${'a'.repeat(32)}-${'b'.repeat(16)}-00`
    )
  })
})
