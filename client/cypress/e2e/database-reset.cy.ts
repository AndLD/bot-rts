export {}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('the reset of the database of a test server', () => {
  it('empties the world from the Dev tools page, keeps the owner signed in, and leaves a server that plays again', () => {
    cy.createAdmin('owner').then(({ token: ownerToken }) => {
      cy.createPlayer().then((player) => {
        cy.deployBaseViaApi(player.token)
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) })
          .its('status')
          .should('eq', 200)

        cy.visitSignedIn('/admin/devtools', ownerToken)
        cy.contains('button', 'Reset the database').click()
        cy.get('.ant-modal textarea').type('a clean slate for the end-to-end suite')
        cy.get('.ant-modal input').type('RESET')
        cy.get('.ant-modal').contains('button', 'Confirm').click()
        cy.contains('The database was reset:', { timeout: 60000 })

        // The player and their login are gone; the owner who pressed the button is still signed in
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token), failOnStatusCode: false })
          .its('status')
          .should('eq', 401)
        cy.apiRequest({ path: '/api/v1/admin/me', headers: bearer(ownerToken) })
          .its('status')
          .should('eq', 200)

        // The engine started again on the empty world: a new player deploys a base and plays
        cy.createPlayer().then((fresh) => {
          cy.deployBaseViaApi(fresh.token).its('id').should('be.a', 'string')
          cy.apiRequest({ path: '/api/v1/bots?type=base', headers: bearer(fresh.token) })
            .its('body')
            .should('have.length', 1)
        })
      })
    })
  })

  it('does nothing without the typed word', () => {
    cy.createAdmin('owner').then(({ token: ownerToken }) => {
      cy.createPlayer().then((player) => {
        cy.visitSignedIn('/admin/devtools', ownerToken)
        cy.contains('button', 'Reset the database').click()
        cy.get('.ant-modal textarea').type('without the word')
        cy.get('.ant-modal input').type('reset')
        cy.get('.ant-modal').contains('button', 'Confirm').click()
        cy.contains('Type RESET to confirm')

        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) })
          .its('status')
          .should('eq', 200)
      })
    })
  })
})
