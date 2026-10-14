import { newEmail } from '../support/commands'

const bearer = (secret: string) => ({ Authorization: `Bearer ${secret}` })

describe('API keys in the account page', () => {
  let token: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
      cy.visit('/account', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
  })

  it('creates a key that is shown once, works within its scopes, and stops working when it is revoked', () => {
    cy.contains('You have no API keys.')
    cy.contains('button', 'Create a key').click()
    cy.get('.ant-modal input#name').type('My dashboard')
    cy.get('.ant-modal').contains('button', 'Create').click()

    // The secret is on screen now, and only now
    cy.get('input[aria-label="The key"]')
      .invoke('val')
      .then((secret) => {
        const key = String(secret)
        expect(key).to.match(/^botrts_[\w-]{43}$/)
        cy.contains('It is not shown again')
        cy.contains('.ant-modal button', 'Done').click()

        cy.contains('My dashboard')
        cy.contains('active')
        cy.contains(`${key.slice(0, 11)}…`)
        cy.reload()
        cy.contains('My dashboard')
        cy.contains(key).should('not.exist')
        cy.get('input[aria-label="The key"]').should('not.exist')

        // The key acts as the player, within the scope it was given
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(key) })
          .its('status')
          .should('equal', 200)
        cy.apiRequest({ path: '/api/v1/bots', headers: bearer(key) })
          .its('status')
          .should('equal', 200)
        cy.apiRequest({
          method: 'POST',
          path: '/api/v1/bots/base',
          headers: bearer(key),
          body: { password: 'secret1' },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.equal(403)
          expect((response.body as { code: string }).code).to.equal('API_KEY_SCOPE')
        })
        // and cannot manage keys, whatever its scopes
        cy.apiRequest({ path: '/api/v1/api-keys', headers: bearer(key), failOnStatusCode: false }).then((response) => {
          expect(response.status).to.equal(403)
          expect((response.body as { code: string }).code).to.equal('SESSION_ONLY')
        })

        cy.contains('button', 'Revoke').click()
        cy.get('.ant-popover').contains('button', 'Revoke').click()
        cy.contains('revoked')
        cy.apiRequest({ path: '/api/v1/bots', headers: bearer(key), failOnStatusCode: false })
          .its('status')
          .should('equal', 401)
      })
  })

  it('sends the scopes that were chosen: a key with the base scope can deploy the base', () => {
    cy.contains('button', 'Create a key').click()
    cy.get('.ant-modal input#name').type('Builder')
    cy.get('.ant-modal input[type=checkbox][value=base]').check({ force: true })
    cy.get('.ant-modal').contains('button', 'Create').click()
    cy.get('input[aria-label="The key"]')
      .invoke('val')
      .then((secret) => {
        cy.contains('.ant-modal button', 'Done').click()

        cy.deployBaseViaApi(String(secret)).its('id').should('be.a', 'string')
      })
    cy.contains('base')
  })
})

describe('a read-only API key', () => {
  it('looks at the game but cannot act in it', () => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ id: baseId }) => {
        cy.createApiKey({ token, scopes: ['read'] }).then((key) => {
          const headers = bearer(key)
          const denied = (request: Parameters<typeof cy.apiRequest>[0]) =>
            cy.apiRequest({ ...request, headers, failOnStatusCode: false }).then((response) => {
              expect(response.status, `${request.method} ${request.path}`).to.equal(403)
              expect((response.body as { code: string }).code).to.equal('API_KEY_SCOPE')
            })

          cy.apiRequest({ path: `/api/v1/bots/${baseId}/modules`, headers })
            .its('status')
            .should('equal', 200)
          cy.apiRequest({ path: `/api/v1/bots/${baseId}/storage`, headers })
            .its('status')
            .should('equal', 200)
          cy.apiRequest({ method: 'POST', path: `/api/v1/bots/${baseId}/scan`, headers })
            .its('status')
            .should('equal', 200)

          denied({ method: 'POST', path: `/api/v1/bots/${baseId}/actions`, body: { fn: 'move', args: [1] } })
          denied({ method: 'POST', path: `/api/v1/bots/${baseId}/executions`, body: { file: '/memory-class1/job.js' } })
          denied({ method: 'POST', path: `/api/v1/bots/${baseId}/factory/craft`, body: { module: 'scanner-class1' } })
          denied({
            method: 'POST',
            path: `/api/v1/bots/${baseId}/maintenance/repair`,
            body: { targetBotId: baseId, moduleId: baseId }
          })
        })
      })
    })
  })
})
