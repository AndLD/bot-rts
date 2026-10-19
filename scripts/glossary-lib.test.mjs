import assert from 'node:assert/strict'
import { test } from 'node:test'
import { glossaryProblems, glossaryRows } from './glossary-lib.mjs'

const GLOSSARY = [
  '| Term | Code name | Aliases | Definition |',
  '| --- | --- | --- | --- |',
  '| **Drive** | `drive` | memory, memory module | A storage volume. |',
  '| **Wireless adapter** | `wirelessAdapter` | control block | The link module. |',
  '| **Chunk** | – | – | A block of cells. |'
].join('\n')

const design = (extra = {}) => ({ '02-glossary.md': GLOSSARY, ...extra })

test('glossaryRows reads the rows and ignores the header and code blocks', () => {
  assert.deepEqual(
    glossaryRows(`${GLOSSARY}\n\`\`\`\n| **Fake** | a | b | c |\n\`\`\``).map(([term]) => term),
    ['Drive', 'Wireless adapter', 'Chunk']
  )
})

test('a glossary whose names are unique and whose emphasised terms are defined has no problems', () => {
  assert.deepEqual(
    glossaryProblems(
      design({
        '04-a.md': 'The map is in **chunks**. The **memory** holds files, **not** code. The **drive** is a volume.',
        '08-b.md': 'A **chunk** again, and the **control block** of the bot.'
      })
    ),
    []
  )
})

test('a term emphasised in two files and not defined is a problem; in one file it is not', () => {
  const problems = glossaryProblems(
    design({ '04-a.md': 'A **live area** and a **local thing**.', '08-b.md': 'The **live area** moves.' })
  )
  assert.deepEqual(problems, ['02-glossary.md: "live area" is emphasised in 04-a.md, 08-b.md but is not defined'])
})

test('stress words, code, the register and the backlog are not terms', () => {
  assert.deepEqual(
    glossaryProblems(
      design({
        '04-a.md': 'It is **not** done, **real** cells, `**inline**`.\n```\n**fenced term**\n```',
        '08-b.md': 'It is **not** done, **real** cells.\n```\n**fenced term**\n```',
        '20-open-questions.md': '**open thing**',
        '21-backlog.md': '**open thing**'
      })
    ),
    []
  )
})

test('one name for one concept: a repeated term or alias is a problem', () => {
  const glossary = `${GLOSSARY}\n| **Memory** | – | – | Another row for the same name. |\n| **Link** | – | control block | Reuses an alias. |`
  assert.deepEqual(glossaryProblems({ '02-glossary.md': glossary }), [
    '02-glossary.md: the name "memory" belongs to both Drive and Memory',
    '02-glossary.md: the name "control block" belongs to both Wireless adapter and Link'
  ])
})

test('every row fills the four columns', () => {
  const problems = glossaryProblems({ '02-glossary.md': `${GLOSSARY}\n| **Tick** | – | The step. |` })
  assert.deepEqual(problems, [
    '02-glossary.md: "Tick" must fill the four columns (term, code name, aliases, definition); use – for none'
  ])
})

test('a missing glossary is a problem', () => {
  assert.deepEqual(glossaryProblems({ '04-a.md': 'text' }), ['02-glossary.md: the glossary is missing'])
})
