import { PRIVACY_POLICY_VERSION } from '../../../lib/utils/privacy'
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
      body: { name, email, password: PASSWORD, acceptedPrivacyVersion: PRIVACY_POLICY_VERSION }
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

export interface Cell {
  x: number
  y: number
}

// Declared here, next to the other custom commands
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Deploys the player's base through the API; resolves to the id of the base and the cell it stands on
      deployBaseViaApi(
        token: string,
        body?: { password?: string; spawnSeed?: string }
      ): Chainable<{ id: string; at: Cell }>
      // Crafts the modules in the factory of the base (the base is stocked first), lets the factory finish and assembles a bot;
      // resolves to the id of the bot, which stands next to the base
      // Puts a bot on a cell. The engine learns of it when it next reads the world, which a scan of the base makes it do.
      teleportBot(options: { token: string; baseId: string; botId: string; x: number; y: number }): Chainable<void>
      // Writes a file on the first drive of a bot, as a player does in the editor
      writeScriptFile(options: { token: string; botId: string; path: string; content: string }): Chainable<void>
      assembleWorker(options: {
        email: string
        token: string
        baseId: string
        modules: string[]
        label?: string
      }): Chainable<string>
    }
  }
}

Cypress.Commands.add('deployBaseViaApi', (token, body = {}) =>
  cy
    .apiRequest({
      method: 'POST',
      path: '/api/v1/bots/base',
      body: { password: 'secret1', ...body },
      headers: { Authorization: `Bearer ${token}` }
    })
    .then((response) => {
      const { bot, mapPoint } = response.body as { bot: { _id: string }; mapPoint: { location: Cell } }

      return { id: bot._id, at: { x: mapPoint.location.x, y: mapPoint.location.y } }
    })
)

// What a base needs in its storage to build a bot of a few modules
const WORKER_STOCK = [
  { resource: 'iron', amount: 900 },
  { resource: 'crystal', amount: 500 },
  { resource: 'gold', amount: 150 },
  { resource: 'oil', amount: 100 }
]

Cypress.Commands.add('assembleWorker', ({ email, token, baseId, modules, label = 'Worker' }) => {
  const headers = { Authorization: `Bearer ${token}` }
  const factory = `/api/v1/bots/${baseId}/factory`

  // The base is stocked by its own id: a player may have more than one
  cy.task('setModuleProps', { botId: baseId, type: 'storage', props: { capacity: 5000, items: WORKER_STOCK } })
  for (const module of modules) {
    cy.apiRequest({ method: 'POST', path: `${factory}/craft`, headers, body: { module } })
  }
  cy.task('finishFactoryJobs', { email, botId: baseId })

  return cy
    .apiRequest({ path: factory, headers })
    .then((status) => {
      const { parts } = status.body as { parts: Array<{ _id: string }> }

      expect(parts).to.have.length(modules.length)

      return cy.apiRequest({
        method: 'POST',
        path: `${factory}/assemble`,
        headers,
        body: { label, partIds: parts.map((part) => part._id) }
      })
    })
    .then((assembled) => (assembled.body as { bot: { _id: string } }).bot._id)
})

Cypress.Commands.add('teleportBot', ({ token, baseId, botId, x, y }) => {
  cy.task('placeBotAt', { botId, x, y })
  // The scan may be refused while the scanner cools down; the engine forgets what it knew of the world either way
  cy.apiRequest({
    method: 'POST',
    path: `/api/v1/bots/${baseId}/scan`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false
  })
})

Cypress.Commands.add('writeScriptFile', ({ token, botId, path, content }) => {
  const headers = { Authorization: `Bearer ${token}` }

  cy.apiRequest({ path: `/api/v1/bots/${botId}/modules`, headers }).then((modules) => {
    const drive = (modules.body as Array<{ _id: string; type: string }>).find((module) => module.type === 'drive')

    expect(drive, 'a drive').to.exist
    cy.apiRequest({
      method: 'PUT',
      path: `/api/v1/bots/${botId}/drives/${drive!._id}/file`,
      headers,
      body: { path, content }
    })
  })
})

// The engine writes the world to the database a little after it happens, so a task that reads the database asks again until it
// sees what it waits for (or gives up after about five seconds and yields the last answer)
export function eventually<T>(
  read: () => Cypress.Chainable<T>,
  isDone: (value: T) => boolean,
  attempts = 20
): Cypress.Chainable<T> {
  return read().then((value) => {
    if (isDone(value) || attempts <= 0) {
      return cy.wrap(value)
    }

    return cy.wait(250, { log: false }).then(() => eventually(read, isDone, attempts - 1))
  })
}

// Clicks the cell `dx` cells east and `dy` cells south of the base, which the map shows in its middle, and clicks again until the
// selector appears: the map learns of a cell a moment after the page opens, and a click on a cell it does not know yet does nothing
export function clickMapUntil(
  dx: number,
  dy: number,
  selector: string,
  text?: string | RegExp,
  attempts = 20
): Cypress.Chainable<unknown> {
  return cy.get('[data-testid=map] canvas').then(($canvas) => {
    cy.wrap($canvas).click(
      Math.floor($canvas[0].clientWidth / 2) + dx * 32,
      Math.floor($canvas[0].clientHeight / 2) + dy * 32
    )

    return cy.get('body').then(($body) => {
      const found = Array.from($body.find(selector)).some((element) =>
        text === undefined
          ? true
          : typeof text === 'string'
            ? element.textContent!.includes(text)
            : text.test(element.textContent!)
      )

      return (
        found || attempts <= 0
          ? cy.wrap(null)
          : cy.wait(500, { log: false }).then(() => clickMapUntil(dx, dy, selector, text, attempts - 1))
      ) as Cypress.Chainable<unknown>
    })
  })
}
