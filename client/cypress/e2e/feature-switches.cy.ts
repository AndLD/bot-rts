import { newEmail } from '../support/commands'

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const PASSWORD = 'Passw0rd!x'

// Sets the features through the console API (the page of the console is covered by the clicks below) and returns them to the default
function switchFeatures(token: string, features: Record<string, boolean>) {
  return cy.apiRequest({
    method: 'PATCH',
    path: '/api/v1/admin/features',
    headers: bearer(token),
    body: { features, reason: 'checked by the end-to-end suite' }
  })
}

describe('the switches of whole features', () => {
  let ownerToken: string

  beforeEach(() => {
    cy.createAdmin('owner').then(({ token }) => {
      ownerToken = token
    })
  })
  afterEach(() => {
    switchFeatures(ownerToken, {
      signUps: true,
      baseDeployment: true,
      apiKeys: true,
      spawnSeeds: true,
      publicApi: true
    })
  })

  it('switches sign-ups off from the console, refuses a sign-up, and switches back', () => {
    cy.visitSignedIn('/admin/economy', ownerToken)
    cy.contains('[role=tab]', 'Features').click()
    cy.get('button[role=switch][aria-label="Sign-ups"]').click()
    cy.get('.ant-modal textarea').type('closing registration for the night')
    cy.get('.ant-modal').contains('button', 'Confirm').click()
    cy.get('.ant-modal').should('not.exist')
    cy.get('button[role=switch][aria-label="Sign-ups"]').should('have.attr', 'aria-checked', 'false')

    cy.apiRequest({
      method: 'POST',
      path: '/api/v1/auth/register',
      body: { name: 'Late', email: newEmail(), password: PASSWORD, acceptedPrivacyVersion: '2026-10-14' },
      failOnStatusCode: false
    }).then((refused) => {
      expect(refused.status).to.eq(403)
      expect((refused.body as { code: string }).code).to.eq('FEATURE_DISABLED')
    })
    cy.clearLocalStorage()
    cy.visit('/auth')
    cy.contains("Don't have an account? Sign up").click()
    cy.contains('Sign-ups are closed for now.')
    cy.contains('button', 'Sign up').should('be.disabled')

    switchFeatures(ownerToken, { signUps: true }).its('status').should('eq', 200)
    cy.apiRequest({
      method: 'POST',
      path: '/api/v1/auth/register',
      body: { name: 'Open', email: newEmail(), password: PASSWORD, acceptedPrivacyVersion: '2026-10-14' }
    })
      .its('status')
      .should('eq', 201)
  })

  it('refuses a base deployment and explains it on the screen, then deploys after the switch back', () => {
    cy.createPlayer().then((player) => {
      switchFeatures(ownerToken, { baseDeployment: false }).its('status').should('eq', 200)
      cy.visitSignedIn('/game', player.token)
      cy.contains('Deploying a base is switched off for now.')
      cy.contains('button', 'Deploy base').should('be.disabled')
      cy.apiRequest({
        method: 'POST',
        path: '/api/v1/bots/base',
        headers: bearer(player.token),
        body: { password: 'secret1' },
        failOnStatusCode: false
      })
        .its('status')
        .should('eq', 403)

      switchFeatures(ownerToken, { baseDeployment: true })
      cy.deployBaseViaApi(player.token).its('id').should('be.a', 'string')
    })
  })

  it('stops the keys when the public API is off and leaves the session working', () => {
    cy.createPlayer().then((player) => {
      cy.createApiKey({ token: player.token, scopes: ['read'] }).then((secret) => {
        switchFeatures(ownerToken, { publicApi: false }).its('status').should('eq', 200)
        cy.apiRequest({
          path: '/api/v1/bots',
          headers: bearer(secret as unknown as string),
          failOnStatusCode: false
        }).then((refused) => {
          expect(refused.status).to.eq(403)
          expect((refused.body as { code: string }).code).to.eq('FEATURE_DISABLED')
        })
        cy.apiRequest({ path: '/api/v1/bots', headers: bearer(player.token) })
          .its('status')
          .should('eq', 200)
      })
    })
  })
})
