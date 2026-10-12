import { newEmail } from '../support/commands'

const BOT_KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

const controlWindow = () => cy.contains('.game-window', 'Control')

function openSettings() {
  cy.contains('.game-toolbar button', 'Settings').click()
}

describe('the control panel and the switches of manual control', () => {
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
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  const act = (fn: string, args: unknown[] = []) =>
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${baseId}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      body: { fn, args },
      failOnStatusCode: false
    })

  it('lists what the modules of the base allow, by category, and does an action as a script would', () => {
    cy.contains('.game-toolbar button', 'Control panel').click()

    controlWindow().within(() => {
      cy.contains('h4', 'Observation')
      cy.contains('h4', 'Maintenance')
      cy.contains('code', 'scan').parent().contains('button', 'Do').click()
      cy.contains('[role=status]', 'Done')

      // A live view needs the scanner in live mode: the failure is an answer, like a script gets it
      cy.contains('code', 'view').parent().contains('button', 'Do').click()
      cy.contains('The scanner is not in live mode')
    })
  })

  it('opens the panel of a bot from the map, checks the arguments before it sends anything and moves the bot', () => {
    cy.assembleWorker({
      email,
      token,
      baseId,
      modules: [...BOT_KIT, 'engine-class1', 'wheels-class1'],
      label: 'Rover'
    }).then((botId) => {
      cy.task('placeBotAt', { botId, x: base.x + 5, y: base.y + 5 })
      cy.reload()
      cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
      cy.get('button[aria-label="Close window"]').click()
      cy.get('[data-testid=map] canvas').then(($canvas) => {
        const [x, y] = [Math.floor($canvas[0].clientWidth / 2), Math.floor($canvas[0].clientHeight / 2)]

        cy.wrap($canvas).click(x + 5 * 32, y + 5 * 32)
      })

      controlWindow().within(() => {
        cy.contains('h4', 'Movement')
        cy.contains('code', 'move').parent().contains('button', 'Do').click()
        cy.contains('cells is needed')
        cy.contains('code', 'move').parent().find('input').type('x')
        cy.contains('code', 'move').parent().contains('button', 'Do').click()
        cy.contains('cells must be a whole number')

        cy.contains('code', 'move').parent().find('input').clear().type('1')
        cy.contains('code', 'move').parent().contains('button', 'Do').click()
        cy.contains('[role=status]', /Done|The way is blocked/)
      })
    })
  })

  it('switches a category off for the player: the panel marks it, and the engine refuses it too', () => {
    cy.contains('.game-toolbar button', 'Control panel').click()
    openSettings()
    cy.contains('.game-window', 'Settings').within(() => {
      cy.get('[data-category=maintenance]').first().click()
    })

    controlWindow().within(() => {
      cy.contains('section[data-category=maintenance]', 'switched off')
      cy.contains('section[data-category=maintenance] button', 'Do').should('be.disabled')
      cy.contains('section[data-category=observation] code', 'scan')
        .parent()
        .contains('button', 'Do')
        .should('be.enabled')
    })

    // What the interface hides is refused by the engine as well
    act('enable', ['not-a-module']).its('body.code').should('equal', 'MANUAL_CATEGORY_DISABLED')
    act('enable', ['not-a-module']).its('status').should('equal', 403)

    cy.contains('.game-window', 'Settings').within(() => {
      cy.get('[data-category=maintenance]').first().click()
    })
    controlWindow().within(() => {
      cy.contains('section[data-category=maintenance]', 'switched off').should('not.exist')
    })
    act('enable', ['not-a-module']).its('status').should('not.equal', 403)
  })

  it('lets an admin switch a category off for the whole game, which no player can switch on again', () => {
    cy.task('setUserStatus', { email, status: 'admin' })
    cy.reload()
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    openSettings()

    cy.contains('.game-window', 'Settings').within(() => {
      cy.contains('h4', 'Game settings')
      cy.get('[aria-label="Game: Fabrication"]').click()
      cy.contains('off in the game')
    })

    cy.apiRequest({ path: '/api/v1/settings', headers: { Authorization: `Bearer ${token}` } })
      .its('body.effective.fabrication')
      .should('equal', false)

    // The player's own switch is on, and it does not help
    cy.apiRequest({ path: '/api/v1/settings', headers: { Authorization: `Bearer ${token}` } })
      .its('body.user.categories.fabrication')
      .should('equal', true)
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${baseId}/factory/craft`,
      headers: { Authorization: `Bearer ${token}` },
      body: { module: 'gun-class1' },
      failOnStatusCode: false
    })
      .its('body.code')
      .should('equal', 'MANUAL_CATEGORY_DISABLED')

    cy.contains('.game-window', 'Settings').within(() => {
      cy.get('[aria-label="Game: Fabrication"]').click()
      cy.contains('off in the game').should('not.exist')
    })
  })

  it('cannot be controlled by hand without a working processor', () => {
    cy.task('damageModule', { botId: baseId, type: 'processor', condition: 0 })
    cy.contains('.game-toolbar button', 'Control panel').click()

    controlWindow().within(() => {
      cy.contains('code', 'scan').parent().contains('button', 'Do').click()
      cy.contains('The bot has no module for this')
    })
  })
})
