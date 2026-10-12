import { newEmail } from '../support/commands'

function command(text: string) {
  cy.get('input.terminal-input').type(text, { parseSpecialCharSequences: false }).type('{enter}')
}

// Writes a file of the selected directory through the editor, the way a player does
function writeFile(name: string, content: string) {
  command(`edit ${name}`)
  cy.contains(`Editing ${name}`)
  cy.get('textarea').type(content, { parseSpecialCharSequences: false, delay: 0 })
  cy.contains('button', 'Save').click()
  cy.contains(`Saved ${name}`)
}

// The id the terminal answered `started <id>` with
function startedId(): Cypress.Chainable<string> {
  return cy
    .contains(/started [0-9a-f-]{36}/)
    .invoke('text')
    .then((text) => /started ([0-9a-f-]{36})/.exec(text)![1])
}

describe('the scripts of the base in the terminal', () => {
  let email: string

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    command('cd memory-class1')
  })

  it('runs a file with arguments, streams its output and says when it ends', () => {
    writeFile('sum.js', 'export async function main(bot, a, b) { bot.log("sum", a + b) }')

    command('run sum.js 2 3')

    cy.contains(/started [0-9a-f-]{36}/)
    cy.contains('sum 5')
    cy.contains('finished')
  })

  it('runs a file by typing its name, and says unknown for a name that is no file', () => {
    writeFile('hello.js', 'export async function main(bot, who) { bot.log("hello", who) }')

    command('hello.js world')
    cy.contains('hello world')

    command('nothing-here')
    cy.contains('Error: Unknown command')
  })

  it('lists the running scripts with top and stops one with kill', () => {
    writeFile('loop.js', 'export async function main(bot) { while (true) { await bot.sleep(500) } }')

    command('run loop.js')
    startedId().then((id) => {
      command('top')
      cy.contains(`id="${id}"`)
      cy.contains('file="/memory-class1/loop.js"')

      command(`kill ${id.slice(0, 8)}`)
      cy.contains(`killed ${id}`)
      cy.contains(`[${id.slice(0, 8)}] killed`)

      command('clear')
      command('top')
      cy.contains('/memory-class1> top')
      cy.contains(`id="${id}"`).should('not.exist')
    })
  })

  it('queues a second script while the processor runs the first', () => {
    writeFile('loop.js', 'export async function main(bot) { while (true) { await bot.sleep(500) } }')

    command('run loop.js')
    cy.contains(/started [0-9a-f-]{36}/)
    command('clear')
    command('run loop.js')
    cy.contains(/started [0-9a-f-]{36}/)
    command('top')

    cy.contains('state="queued"')
  })

  it('shows the error that ended a failing script', () => {
    writeFile('boom.js', 'export async function main() { throw new Error("boom") }')

    command('run boom.js')

    cy.contains('boom')
    cy.contains('killed')
  })

  it('evaluates lines in the shell mode', () => {
    command('shell')
    cy.contains('Bot shell')

    command('1 + 2')
    cy.contains('3')
    command('bot.log("from the shell")')
    cy.contains('from the shell')
    command('bot.modules.length > 0')
    cy.contains('true')

    command('exit')
    cy.contains('/memory-class1>')
  })

  it('runs TypeScript that imports a library and a JSON file', () => {
    writeFile('twice.ts', 'export const twice = (n: number): number => n * 2')
    writeFile('cfg.json', '{ "name": "cfg" }')
    writeFile(
      'main.ts',
      'import { twice } from "./twice"\nimport cfg from "./cfg.json"\nexport async function main(bot: any, n: number) { bot.log(twice(n), cfg.name) }'
    )

    command('main.ts 21')

    cy.contains('42 cfg')
  })

  it('refuses a script whose imports cannot be loaded', () => {
    writeFile('a.js', 'import "./b"\nexport async function main() {}')
    writeFile('b.js', 'import "./a"')
    command('run a.js')
    cy.contains('Cyclic import')

    writeFile('c.js', 'import "./missing"\nexport async function main() {}')
    command('run c.js')
    cy.contains('Cannot find "./missing"')
  })

  it('keeps the sandbox closed: no host objects, no network', () => {
    writeFile(
      'probe.js',
      'export async function main(bot) { bot.log(typeof process, typeof require, typeof Date, typeof fetch, typeof globalThis.constructor.constructor) }'
    )

    command('run probe.js')

    cy.contains('undefined undefined undefined undefined function')
  })

  it('goes on running and keeps the output while the player is away', () => {
    writeFile('later.js', 'export async function main(bot) { await bot.sleep(1500); bot.log("done while away") }')

    command('run later.js')
    cy.contains(/started [0-9a-f-]{36}/)
    cy.visit('/')

    cy.task<string[]>('terminalLines', { email }, { timeout: 10000 }).should((lines) => {
      expect(lines.some((line) => line.includes('done while away'))).to.equal(true)
    })
  })
})
