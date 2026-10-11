export const PASSWORD = 'Pa$$w0rd1'

let counter = 0

// The client address of the running test (see the beforeEach below)
let clientAddress = ''

// A test-unique mailbox, so tests never see each other's players or emails
export function newEmail(prefix = 'player'): string {
  counter += 1

  return `${prefix}-${Date.now()}-${counter}@example.com`
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Registers through the API; resolves to the access token
      // A request to the API from this test's client address; `path` is relative to the API, e.g. /api/v1/bots/base
      apiRequest(options: Partial<Cypress.RequestOptions> & { path: string }): Chainable<Cypress.Response<unknown>>
      register(email: string, name?: string): Chainable<string>
      // The path and query of the newest emailed link with this subject (waits for the email to arrive)
      emailedLink(to: string, subject: string): Chainable<string>
      // Registers, follows the verification link and logs in through the API; the page then opens signed in
      createPlayer(email?: string): Chainable<{ email: string; token: string }>
      // Logs in through the form of the login page
      loginViaForm(email: string, password?: string): Chainable<void>
    }
  }
}

// One client address per test for the requests the tests send themselves (`apiRequest`): the API rate-limits per address
// and trusts X-Forwarded-For here. The browser's own requests share one address, so the API runs with a limit high
// enough for them (scripts/e2e.mjs).
beforeEach(() => {
  clientAddress = `10.${Cypress._.random(0, 250)}.${Cypress._.random(0, 250)}.${Cypress._.random(1, 250)}`
})

Cypress.Commands.add('apiRequest', ({ path, headers, ...options }) =>
  cy.request({
    ...options,
    url: `${Cypress.expose('apiUrl')}${path}`,
    headers: { ...headers, 'x-forwarded-for': clientAddress }
  })
)

Cypress.Commands.add('register', (email, name = 'Jon') =>
  cy
    .request({
      method: 'POST',
      url: `${Cypress.expose('apiUrl')}/api/v1/auth/register`,
      headers: { 'x-forwarded-for': clientAddress },
      body: { name, email, password: PASSWORD }
    })
    .its('body.accessToken')
)

Cypress.Commands.add('emailedLink', (to, subject) => {
  const find = (attempt = 0): Cypress.Chainable<string> =>
    cy.task<string | null>('mailLink', { to, subject }, { log: false }).then((link) => {
      if (link) {
        const url = new URL(link.replace(/&amp;/g, '&'))

        return cy.wrap(`${url.pathname}${url.search}`)
      }
      if (attempt >= 40) {
        throw new Error(`No email "${subject}" to ${to}`)
      }

      return cy.wait(250, { log: false }).then(() => find(attempt + 1))
    })

  return find()
})

Cypress.Commands.add('createPlayer', (email = newEmail()) =>
  cy.register(email).then(() =>
    cy.emailedLink(email, 'Confirm your email').then((link) => {
      const token = new URL(link, 'http://x').searchParams.get('token')

      return cy
        .request({
          method: 'POST',
          url: `${Cypress.expose('apiUrl')}/api/v1/auth/email/verify`,
          headers: { 'x-forwarded-for': clientAddress },
          body: { token }
        })
        .then(() =>
          cy
            .request({
              method: 'POST',
              url: `${Cypress.expose('apiUrl')}/api/v1/auth/login`,
              headers: { 'x-forwarded-for': clientAddress },
              body: { email, password: PASSWORD }
            })
            .its('body.accessToken')
            .then((accessToken: string) => ({ email, token: accessToken }))
        )
    })
  )
)

Cypress.Commands.add('loginViaForm', (email, password = PASSWORD) => {
  cy.visit('/auth')
  cy.get('input[type=email]').type(email)
  cy.get('input[type=password]').type(password, { parseSpecialCharSequences: false })
  cy.contains('button', 'Log in').click()
})
