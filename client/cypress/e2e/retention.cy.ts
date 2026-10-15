export {}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// Reads the retention settings through the API of the console
const retention = (token: string) =>
  cy
    .apiRequest({ path: '/api/v1/admin/retention', headers: bearer(token) })
    .its('body') as unknown as Cypress.Chainable<{
    jobs: Array<{ job: string; values: Record<string, number | boolean>; isOverridden: boolean }>
  }>

function confirmWithReason(reason: string) {
  cy.get('.ant-modal textarea').type(reason)
  cy.get('.ant-modal').contains('button', 'Confirm').click()
  cy.get('.ant-modal').should('not.exist')
}

describe('the retention settings', () => {
  let ownerToken: string

  beforeEach(() => {
    cy.createAdmin('owner').then(({ token }) => {
      ownerToken = token
    })
  })
  afterEach(() => {
    cy.apiRequest({
      method: 'POST',
      path: '/api/v1/admin/retention/reset',
      headers: bearer(ownerToken),
      body: { reason: 'checked by the end-to-end suite' }
    })
  })

  it('changes a range and a switch from the Operations page, and puts everything back with one button', () => {
    cy.visitSignedIn('/admin/operations', ownerToken)
    cy.contains('Data retention')

    cy.get('input[aria-label="Finished script executions: keep"]').clear().type('10').blur()
    cy.get('button[role=switch][aria-label="Notifications"]').click()
    cy.contains('button', 'Save changes').click()
    confirmWithReason('keep less, and stop the notifications cleanup')

    retention(ownerToken).then(({ jobs }) => {
      const executions = jobs.find((job) => job.job === 'executions')
      expect(executions?.values).to.include({ days: 10 })
      expect(executions?.isOverridden).to.eq(true)
      expect(jobs.find((job) => job.job === 'notifications')?.values).to.include({ isEnabled: false })
    })
    cy.contains('changed')

    cy.contains('button', 'Reset all to the defaults').click()
    confirmWithReason('back to the defaults')
    retention(ownerToken).then(({ jobs }) => {
      expect(jobs.every((job) => !job.isOverridden)).to.eq(true)
    })
  })

  it('refuses a value outside its range, and keeps the erasure of accounts behind a typed word', () => {
    cy.apiRequest({
      method: 'PATCH',
      path: '/api/v1/admin/retention',
      headers: bearer(ownerToken),
      body: { jobs: { executions: { days: 0 } }, reason: 'too small' },
      failOnStatusCode: false
    })
      .its('status')
      .should('eq', 400)
    cy.apiRequest({
      method: 'PATCH',
      path: '/api/v1/admin/retention',
      headers: bearer(ownerToken),
      body: { jobs: { inactiveAccounts: { isEnabled: false } }, reason: 'switch off' }
    })
      .its('status')
      .should('eq', 200)
    cy.apiRequest({
      method: 'PATCH',
      path: '/api/v1/admin/retention',
      headers: bearer(ownerToken),
      body: { jobs: { inactiveAccounts: { isEnabled: true } }, reason: 'without the word' },
      failOnStatusCode: false
    })
      .its('status')
      .should('eq', 400)
  })

  it('is read-only for a moderator', () => {
    cy.createAdmin('moderator').then(({ token }) => {
      cy.visitSignedIn('/admin/operations', token)
      cy.contains('Data retention')
      cy.get('button[role=switch][aria-label="Notifications"]').should('be.disabled')
      cy.contains('button', 'Save changes').should('not.exist')
      cy.apiRequest({
        method: 'POST',
        path: '/api/v1/admin/retention/reset',
        headers: bearer(token),
        body: { reason: 'not allowed' },
        failOnStatusCode: false
      })
        .its('status')
        .should('eq', 403)
    })
  })
})
