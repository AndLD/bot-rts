import { newEmail } from '../support/commands'

function command(text: string) {
  cy.get('input.terminal-input').type(`${text}{enter}`)
}

describe('the files of the base in the terminal', () => {
  let email: string

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  it('lists the drive of the starter kit and moves into it and back', () => {
    command('ls')
    cy.contains('memory-class1')
    cy.contains('/65536 B')

    command('cd memory-class1')
    cy.contains('/memory-class1>')

    command('cd ..')
    cy.contains('/>')
  })

  it('creates a directory, writes a file in the editor, shows it and deletes it', () => {
    command('cd memory-class1')
    command('mkdir scripts')
    command('cd scripts')
    cy.contains('/memory-class1/scripts>')

    command('edit mine.js')
    cy.contains('Editing mine.js')
    cy.get('textarea').type('export function main() {}')
    cy.contains('button', 'Save').click()
    cy.contains('Saved scripts/mine.js')

    command('ls')
    cy.contains('mine.js 25 B')
    command('cat mine.js')
    cy.contains('export function main() {}')

    command('rm mine.js')
    command('cd ..')
    command('rm scripts')
    // The commands are served one after the other and the engine answers at its next tick: wait until the last reply is there
    command('ls')
    cy.contains('/memory-class1> ls')
    command('clear')
    command('ls')
    cy.contains('/memory-class1> ls')
    cy.contains('scripts/').should('not.exist')
  })

  it('opens a file again with what was saved, and leaves it alone on cancel', () => {
    command('cd memory-class1')
    command('edit notes.txt')
    cy.get('textarea').type('first')
    cy.contains('button', 'Save').click()
    cy.contains('Saved notes.txt')

    command('edit notes.txt')
    cy.get('textarea').should('have.value', 'first').type(' and more')
    cy.contains('button', 'Cancel').click()

    command('cat notes.txt')
    cy.get('textarea').should('not.exist')
    cy.contains('first and more').should('not.exist')
  })

  it('explains what is wrong with a command', () => {
    command('mkdir scripts')
    cy.contains('No drive selected')

    command('cd memory-class1')
    command('cat nope.js')
    cy.contains('Error: Not found')

    command('edit bad.exe')
    cy.get('textarea').should('not.exist')
    cy.contains('Please check the entered data')

    command('cat')
    cy.contains('Usage: cat <file>')
  })

  it('stores the session with every command and its output', () => {
    command('cd memory-class1')
    command('mkdir scripts')
    command('ls')
    cy.contains('scripts/')

    cy.task<string[]>('terminalLines', { email }).should((lines) => {
      expect(lines).to.include('input: cd memory-class1')
      expect(lines).to.include('input: mkdir scripts')
      expect(lines).to.include('input: ls')
      expect(lines).to.include('output: scripts/')
    })
  })
})
