const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// Opens the dialog, fills it in and confirms; returns the secret the console shows once
function createKeyInConsole(name: string, reason = 'checked by the end-to-end suite') {
  cy.contains('button', 'Create a key').click()
  cy.get('.ant-modal input#name').type(name)
  cy.contains('.ant-modal label', 'admin:audit:read').click()
  cy.get('.ant-modal textarea').type(reason)
  cy.get('.ant-modal').contains('button', 'Confirm').click()
  cy.get('.ant-modal').should('not.exist')

  return cy.get('[data-testid=admin-key-secret]').invoke('text')
}

const readAudit = (secret: string) =>
  cy.apiRequest({ path: '/api/v1/admin/audit', headers: bearer(secret), failOnStatusCode: false })

describe('admin API keys for an AI assistant', () => {
  it('are created in the console, open only what their scope allows, and show the secret once', () => {
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin/api-keys', token)

      createKeyInConsole('Investigation').then((secret) => {
        expect(secret).to.match(/^botrts_/)
        readAudit(secret).its('status').should('eq', 200)
        // The scope is for the audit trail: the logs, the players and the other pages of the console stay closed
        cy.apiRequest({ path: '/api/v1/admin/logs', headers: bearer(secret), failOnStatusCode: false })
          .its('body.code')
          .should('eq', 'API_KEY_SCOPE')
        cy.apiRequest({ path: '/api/v1/admin/players', headers: bearer(secret), failOnStatusCode: false })
          .its('status')
          .should('eq', 403)
      })
      cy.contains('td', 'Investigation')
      cy.contains('Active')
    })
  })

  it('stop at once when the owner stops being an admin', () => {
    cy.createAdmin('admin').then(({ token, email }) => {
      cy.visitSignedIn('/admin/api-keys', token)

      createKeyInConsole('Soon useless').then((secret) => {
        readAudit(secret).its('status').should('eq', 200)
        cy.task('setUserStatus', { email, status: 'user' })
        readAudit(secret).its('status').should('eq', 401)
      })
    })
  })

  it('are revoked in the console with a reason, and the call shows in the audit trail with the key', () => {
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin/api-keys', token)

      createKeyInConsole('To revoke').then((secret) => {
        readAudit(secret).its('status').should('eq', 200)
        cy.contains('button', 'Revoke').click()
        cy.get('.ant-modal textarea').type('no longer needed')
        cy.get('.ant-modal').contains('button', 'Confirm').click()
        cy.get('.ant-modal').should('not.exist')
        cy.contains('Revoked')
        readAudit(secret).its('status').should('eq', 401)
      })
      cy.apiRequest({ path: '/api/v1/admin/audit?action=apikeys.admin.revoke', headers: bearer(token) })
        .its('body.result')
        .should('have.length.greaterThan', 0)
    })
  })

  it('are not offered to a role without the permission, and never to a player', () => {
    cy.createAdmin('moderator').then(({ token }) => {
      cy.apiRequest({ path: '/api/v1/admin/api-keys', headers: bearer(token), failOnStatusCode: false })
        .its('status')
        .should('eq', 403)
      cy.visitSignedIn('/admin', token)
      cy.get('.ant-layout-sider').contains('a', 'Admin API keys').should('not.exist')
    })
    cy.createPlayer().then(({ token }) => {
      cy.apiRequest({
        method: 'POST',
        path: '/api/v1/api-keys',
        headers: bearer(token),
        body: { name: 'escalate', scopes: ['read', 'admin:audit:read'] },
        failOnStatusCode: false
      })
        .its('status')
        .should('eq', 400)
    })
  })
})
