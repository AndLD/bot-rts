import { eventually, newEmail } from '../support/commands'

function command(text: string) {
  cy.get('input.terminal-input').first().type(text, { parseSpecialCharSequences: false }).type('{enter}')
}

// Asks the API again until the answer is what the test waits for: what the engine and the consumers of its events do is done a
// moment after it happens
function poll<T>(token: string, path: string, isDone: (body: T) => boolean): Cypress.Chainable<T> {
  return eventually(
    () =>
      cy
        .apiRequest({ path, headers: { Authorization: `Bearer ${token}` } })
        .its('body') as unknown as Cypress.Chainable<T>,
    isDone,
    60
  )
}

type Notifications = { items: Array<{ kind: string; count: number; botId: string }> }

describe('the energy of a base and of its bots', () => {
  let email: string
  let token: string
  let baseId: string
  let base: { x: number; y: number }

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token).then((deployed) => {
        baseId = deployed.id
        base = deployed.at
      })
    })
  })

  const openGame = () => {
    cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  }

  // The engine reads the world again after an action of the base: what a task wrote into the database is seen
  const letTheEngineLook = () =>
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${baseId}/scan`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false
    })

  it('starts on a solar panel that burns nothing: there is no generator, and the oil stays in the storage', () => {
    openGame()

    command('modules')
    cy.contains('solar-panel-class1')
    cy.contains('generator-class1').should('not.exist')

    cy.wait(3000)
    // The other starter resources are for crafting (design §6.1); only the oil is checked here
    cy.task<Record<string, number>>('stockOf', { botId: baseId }).its('oil').should('equal', 50)
  })

  it('tells that the energy is low once, however long it stays low', () => {
    // Little energy and no sun: the battery only goes down
    cy.task('setModuleProps', { botId: baseId, type: 'battery', props: { value: 5 } })
    cy.task('setModuleProps', { botId: baseId, type: 'solarPanel', props: { isEnabled: false } })
    openGame()

    poll<Notifications>(token, '/api/v1/notifications', ({ items }) => items.some((item) => item.kind === 'energyLow'))
    // The battery runs dry in the meantime, which is no news of the same kind
    cy.wait(6000)

    poll<Notifications>(token, '/api/v1/notifications', () => true).should(({ items }) => {
      const low = items.filter((item) => item.kind === 'energyLow')

      expect(low).to.have.length(1)
      expect(low[0].count).to.equal(1)
    })
    eventually(
      () => cy.task<Record<string, unknown>>('modulePropsOf', { botId: baseId, type: 'battery' }),
      (props) => props.isLowReported === true
    ).should('include', { isLowReported: true })
  })

  it('keeps a bot that ran out of energy off the radio until its energy has grown back to the resume threshold', () => {
    openGame()
    cy.assembleWorker({
      email,
      token,
      baseId,
      modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1']
    }).then((botId) => {
      const notified =
        (kind: string) =>
        ({ items }: Notifications) =>
          items.some((item) => item.kind === kind && item.botId === botId)
      const charge = (value: number) => {
        cy.task('setModuleProps', { botId, type: 'battery', props: { value } })
        letTheEngineLook()
      }

      cy.task('placeBotAt', { botId, x: base.x + 5, y: base.y + 5 })
      letTheEngineLook()

      // Out of energy (a unit is gone in a second to the idle cost of its modules): the radio link is down, and the engine keeps
      // the state in the battery
      charge(1)
      poll<Notifications>(token, '/api/v1/notifications', notified('linkLost'))
      eventually(
        () => cy.task<Record<string, unknown>>('modulePropsOf', { botId, type: 'battery' }),
        (props) => props.isUnpowered === true
      ).should('include', { isUnpowered: true })

      // A few units are not enough: it stays dark
      charge(5)
      cy.wait(4000)
      poll<Notifications>(token, '/api/v1/notifications', () => true).should(({ items }) =>
        expect(items.some((item) => item.kind === 'linkRestored' && item.botId === botId)).to.equal(false)
      )

      // Past the threshold it powers on, and the link is back
      charge(12)
      poll<Notifications>(token, '/api/v1/notifications', notified('linkRestored'))
    })
  })
})
