import { newEmail } from '../support/commands'

function openGame(token: string) {
  cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
}

describe('deploying again after the base was lost', () => {
  it('shows the deploy screen again, deploys a new base and hides the corpse', () => {
    const email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ id: oldId }) => {
        openGame(token)
        cy.contains('# Welcome to BotOS Alpha 0.1.0 #')

        cy.task('breakBaseAdapter', { email })
        cy.reload()
        cy.contains('h2', 'Deploy your base')

        cy.get('input[type=password]').first().type('secret2')
        cy.get('input[type=password]').last().type('secret2')
        cy.get('button[type=submit]').click()
        cy.contains('.ant-modal button', 'Deploy').click()

        cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
        cy.get('input.terminal-input').type('list{enter}')
        cy.contains('(current) id="')
        cy.contains(`id="${oldId}"`).should('not.exist')
      })
    })
  })

  it('refuses the terminal of the lost base, and a second base while one lives', () => {
    const email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ id: oldId }) => {
        cy.apiRequest({
          method: 'POST',
          path: '/api/v1/bots/base',
          body: { password: 'secret1' },
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false
        })
          .its('status')
          .should('eq', 403)

        cy.task('breakBaseAdapter', { email })
        cy.apiRequest({
          path: `/api/v1/bots/${oldId}/bots`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false
        }).should((response) => {
          expect(response.status).to.eq(403)
          expect((response.body as { code: string }).code).to.eq('BASE_LOST')
        })

        cy.deployBaseViaApi(token).then(({ id: newId }) => expect(newId).not.to.eq(oldId))
      })
    })
  })
})
