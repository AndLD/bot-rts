import { newEmail } from '../support/commands'

const banner = '[data-testid=connection-banner]'

describe('losing the connection to the server', () => {
  it('shows the loss, reconnects by itself when the API is back, and the page and the terminal keep working', () => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    // Marks this document, so that a reload of the page would be noticed
    cy.window().then((win) => Object.assign(win, { isSameDocument: true }))

    cy.task('stopApi', null, { timeout: 40_000 })
    cy.get(banner, { timeout: 30_000 }).should('be.visible')

    cy.task('startApi')
    cy.contains(banner, 'Connection restored', { timeout: 120_000 })
    // It is shown for a few seconds, then it goes
    cy.get(banner, { timeout: 15_000 }).should('not.exist')

    cy.window().its('isSameDocument').should('equal', true)
    cy.contains('Reconnected: a new terminal session is open.')
    cy.get('.game-window').should('have.length', 1)
    cy.get('input.terminal-input').type('list{enter}')
    cy.contains('(current) id="')
    cy.get('[data-testid=map] canvas').should('be.visible')
  })
})
