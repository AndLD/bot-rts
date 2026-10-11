import { newEmail, PASSWORD } from '../support/commands'

// A well-formed access token that expired long ago
function expiredToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: 1 })}.signature`
}

describe('sessions', () => {
  it('sends a visitor who is not signed in to the login page', () => {
    cy.visit('/game')

    cy.location('pathname').should('eq', '/auth')
  })

  it('logs in, keeps the session over a reload and logs out', () => {
    const { email } = { email: newEmail() }
    cy.createPlayer(email)

    cy.loginViaForm(email)
    cy.location('pathname').should('eq', '/game')

    cy.reload()
    cy.location('pathname').should('eq', '/game')

    cy.visit('/account')
    cy.contains('button', 'Sign out').click()
    cy.location('pathname').should('eq', '/auth')
    cy.window().its('localStorage').invoke('getItem', 'token').should('be.null')

    cy.visit('/game')
    cy.location('pathname').should('eq', '/auth')
  })

  it('shows a wrong password as an error and stays on the login page', () => {
    const email = newEmail()
    cy.createPlayer(email)

    cy.loginViaForm(email, 'Wr0ng$pass')

    cy.contains('.ant-notification', 'The email or the password is wrong')
    cy.location('pathname').should('eq', '/auth')
  })

  it('refreshes an expired access token with the refresh cookie', () => {
    const email = newEmail()
    cy.createPlayer(email)
    cy.loginViaForm(email)
    cy.location('pathname').should('eq', '/game')

    const stale = expiredToken()
    cy.window().then((win) => win.localStorage.setItem('token', stale))
    cy.reload()

    cy.location('pathname').should('eq', '/game')
    cy.window().its('localStorage').invoke('getItem', 'token').should('not.eq', stale).and('not.be.null')
  })

  it('ends the session when the access token expired and the refresh cookie is gone', () => {
    const email = newEmail()
    cy.createPlayer(email)
    cy.loginViaForm(email)
    cy.location('pathname').should('eq', '/game')

    cy.clearCookies()
    cy.window().then((win) => win.localStorage.setItem('token', expiredToken()))
    cy.reload()

    cy.location('pathname').should('eq', '/auth')
  })

  it('keeps a banned player out at login', () => {
    const email = newEmail()
    cy.createPlayer(email)
    cy.task('setUserStatus', { email, status: 'banned' })

    cy.loginViaForm(email)

    cy.contains('.ant-notification', 'Your account is blocked')
    cy.location('pathname').should('eq', '/auth')
  })

  it('cuts off a player who is banned in the middle of a session', () => {
    const email = newEmail()
    cy.createPlayer(email)
    cy.loginViaForm(email)
    cy.location('pathname').should('eq', '/game')

    cy.task('setUserStatus', { email, status: 'banned' })
    cy.reload()

    cy.location('pathname').should('eq', '/blocked')
    cy.contains('Your account is blocked')
  })

  it('limits the requests of one client address', () => {
    const request = () =>
      cy.apiRequest({
        method: 'POST',
        path: '/api/v1/auth/login',
        body: { email: newEmail('nobody'), password: 'Wr0ng$pass' },
        failOnStatusCode: false
      })

    // The API of this run allows 200 attempts per window and address
    Cypress._.times(200, request)
    request().then((response) => {
      expect(response.status).to.eq(429)
      expect(response.body).to.have.property('code', 'TOO_MANY_REQUESTS')
    })
  })

  it('tells the player when the server refuses a login for too many requests', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 429,
      body: { statusCode: 429, code: 'TOO_MANY_REQUESTS', error: 'Invalid request' }
    })

    cy.loginViaForm(newEmail(), PASSWORD)

    cy.contains('.ant-notification', 'Too many requests, try again later')
    cy.location('pathname').should('eq', '/auth')
  })
})
