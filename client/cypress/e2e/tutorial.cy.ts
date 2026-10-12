import { newEmail } from '../support/commands'

const step = (id: string, state: 'done' | 'current') =>
  cy
    .get(`.tutorial-overlay li[data-step=${id}]`, { timeout: 12000 })
    .should('have.attr', state === 'done' ? 'data-done' : 'data-current', 'true')

describe('the tutorial', () => {
  beforeEach(() => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  it('walks through real actions: each step is ticked when the player does it', () => {
    cy.contains('.tutorial-overlay', 'Getting started')
    step('openTerminal', 'done')
    step('listModules', 'current')
    cy.contains('.tutorial-hint', 'Type modules in the terminal.')
    cy.contains('button.tutorial-highlight', 'Terminal')

    cy.get('input.terminal-input').type('modules{enter}')
    step('listModules', 'done')
    step('scan', 'current')
    cy.contains('button.tutorial-highlight', 'Control panel')

    cy.contains('button', 'Control panel').click()
    cy.contains('code', 'scan').parent().contains('button', 'Do').click()
    step('scan', 'done')
    step('writeScript', 'current')
  })

  it('can be skipped, stays skipped after a reload and is started again from the settings', () => {
    cy.contains('.tutorial-overlay button', 'Skip the tutorial').click()
    cy.get('.tutorial-overlay').should('not.exist')

    cy.reload()
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('.tutorial-overlay').should('not.exist')

    cy.contains('button', 'Settings').click()
    cy.contains('button', 'Show the tutorial again').click()
    cy.contains('.tutorial-overlay', 'Getting started')
    step('openTerminal', 'done')
  })
})
