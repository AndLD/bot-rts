import { newEmail } from '../support/commands'

// Opens the game as the player: the access token is what the client keeps in the browser
function openGame(token: string) {
  cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
}

describe('deploying the base', () => {
  beforeEach(() => {
    cy.createPlayer(newEmail()).then(({ token }) => openGame(token))
    cy.contains('h2', 'Deploy your base')
  })

  it('checks the password before it asks to confirm', () => {
    cy.get('button[type=submit]').click()
    cy.contains('Please enter a password for your base')

    cy.get('input[type=password]').first().type('abc')
    cy.get('input[type=password]').last().type('abd')
    cy.get('button[type=submit]').click()

    cy.contains('The password must have 6-64 characters')
    cy.contains('The passwords do not match')
    cy.contains('Deploy your base?').should('not.exist')
  })

  it('deploys the base after the confirmation and opens its terminal', () => {
    cy.get('input[type=password]').first().type('secret1')
    cy.get('input[type=password]').last().type('secret1')
    cy.get('button[type=submit]').click()

    cy.contains('Deploy your base?')
    cy.contains('.ant-modal button', 'Deploy').click()

    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('input.terminal-input').type('list{enter}')
    cy.contains('(current) id="')
  })

  it('does not deploy when the player cancels the confirmation', () => {
    cy.get('input[type=password]').first().type('secret1')
    cy.get('input[type=password]').last().type('secret1')
    cy.get('button[type=submit]').click()
    cy.contains('.ant-modal button', 'Cancel').click()

    cy.contains('h2', 'Deploy your base')
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #').should('not.exist')
  })
})
