import {
  findScriptFunction,
  isGranted,
  SCRIPT_FUNCTIONS,
  SCRIPT_MAX_LIST_LENGTH,
  SCRIPT_MAX_STRING_LENGTH,
  scriptFunctionsFor,
  validateScriptArgs
} from '../../../../lib/utils/script-api'

const spec = (name: string) => findScriptFunction(name)!

describe('script function catalog', () => {
  it('lists every function once', () => {
    const names = SCRIPT_FUNCTIONS.map((fn) => fn.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('grants a function by any of its modules, and sleep to every bot', () => {
    expect(scriptFunctionsFor([])).toEqual(['sleep'])
    expect(scriptFunctionsFor(['scanner', 'gps'])).toEqual(['sleep', 'scan', 'getLocation'])
    expect(isGranted(spec('scan'), new Set(['drive']))).toBe(false)
    expect(isGranted(spec('scan'), new Set(['scanner']))).toBe(true)
  })

  it('knows no function it does not list', () => {
    expect(findScriptFunction('process')).toBeUndefined()
  })
})

describe('validateScriptArgs', () => {
  it('accepts arguments that fit', () => {
    expect(validateScriptArgs(spec('scan'), [])).toBeNull()
    expect(validateScriptArgs(spec('craft'), ['scanner-class1'])).toBeNull()
    expect(validateScriptArgs(spec('craft'), ['scanner-class1', 3])).toBeNull()
    expect(validateScriptArgs(spec('craft'), ['scanner-class1', null])).toBeNull()
    expect(validateScriptArgs(spec('assemble'), [null, ['a', 'b']])).toBeNull()
    expect(validateScriptArgs(spec('assemble'), ['Scout', []])).toBeNull()
  })

  it('rejects missing, extra and mistyped arguments', () => {
    expect(validateScriptArgs(spec('scan'), [1])).toMatch(/at most 0/)
    expect(validateScriptArgs(spec('craft'), [])).toMatch(/module is required/)
    expect(validateScriptArgs(spec('assemble'), [null, null])).toMatch(/partIds is required/)
    expect(validateScriptArgs(spec('craft'), [5])).toMatch(/module must be a string/)
    expect(validateScriptArgs(spec('craft'), ['m', 1.5])).toMatch(/count must be an integer/)
    expect(validateScriptArgs(spec('sleep'), ['1'])).toMatch(/ms must be an integer/)
    expect(validateScriptArgs(spec('assemble'), [5, []])).toMatch(/label must be a string or null/)
    expect(validateScriptArgs(spec('assemble'), [null, 'a'])).toMatch(/partIds must be a list/)
    expect(validateScriptArgs(spec('assemble'), [null, [1]])).toMatch(/partIds must be a list/)
  })

  it('limits the size of strings and lists', () => {
    expect(validateScriptArgs(spec('read'), ['x'.repeat(SCRIPT_MAX_STRING_LENGTH + 1)])).toMatch(
      /path must be a string/
    )
    expect(validateScriptArgs(spec('assemble'), [null, new Array(SCRIPT_MAX_LIST_LENGTH + 1).fill('a')])).toMatch(
      /partIds must be a list/
    )
  })

  it('checks directions', () => {
    const turn = { name: 'turn', modules: [], ops: 1, args: [{ name: 'direction', kind: 'direction' as const }] }
    expect(validateScriptArgs(turn, ['left'])).toBeNull()
    expect(validateScriptArgs(turn, ['up'])).toMatch(/'left' or 'right'/)
  })
})
