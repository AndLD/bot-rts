import { newEmail, clickMapUntil } from '../support/commands'

const BOT_KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

describe('the storage and the factory windows', () => {
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

  it('shows what the base stores', () => {
    cy.task('stockBase', {
      email,
      items: [
        { resource: 'oil', amount: 50 },
        { resource: 'gold', amount: 7 }
      ]
    })
    cy.contains('.game-toolbar button', 'Storage').click()

    cy.contains('.game-window', 'Storage').within(() => {
      cy.contains('Storage: 57 of 5000')
      cy.contains('Oil: 50')
      cy.contains('Gold: 7')
      cy.contains('Nothing in hands')
    })
  })

  it('takes an item from the cell ahead and drops it again', () => {
    cy.assembleWorker({ email, token, baseId, modules: [...BOT_KIT, 'manipulator-class1'], label: 'Hand' }).then(
      (botId) => {
        cy.task('placeBotAt', { botId, x: base.x + 6, y: base.y + 6 })
        cy.task('placeItemAhead', { botId, type: 'part', name: 'wheels-class1' })
        // The engine reads the world again after an action of the base
        cy.apiRequest({
          method: 'POST',
          path: `/api/v1/bots/${baseId}/scan`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false
        })
        cy.contains('.game-toolbar button', 'Control panel').click()
        cy.contains('.game-window', 'Control').find('button[aria-label="Close window"]').click()

        // The bot's panel opens from the map, and so does its storage
        cy.reload()
        cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
        cy.get('button[aria-label="Close window"]').click()
        clickMapUntil(6, 6, '.game-window-title', 'Control')
        cy.contains('.game-window', 'Control').within(() => {
          cy.contains('button', 'Storage').click()
        })

        cy.contains('.game-window-title', 'Storage')
          .closest('.game-window')
          .within(() => {
            cy.contains('Nothing in hands')
            cy.contains('button', 'Take the item ahead').click()
            cy.contains('Part wheels-class1')
            cy.contains('button', 'Drop the last item ahead').click()
            cy.contains('Nothing in hands')
            // The cell ahead is taken again by the item just dropped: a second drop has nothing to drop
            cy.contains('button', 'Drop the last item ahead').should('be.disabled')
          })
      }
    )
  })

  it('crafts a module in the factory window, waits for the factory, and refuses an assembly that is not a bot', () => {
    // The base burns oil for its energy, and the engine writes the storage it remembers whenever the oil changes, which wipes what a
    // test puts into the database. So the base is quieted first and the engine made to read it again (a scan of the base does it).
    cy.task('quietBase', { botId: baseId })
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${baseId}/scan`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false
    })
    cy.task('stockBase', {
      email,
      items: [
        { resource: 'iron', amount: 600 },
        { resource: 'crystal', amount: 400 },
        { resource: 'gold', amount: 100 }
      ]
    })

    cy.contains('.game-toolbar button', 'Factory').click()
    cy.contains('.game-window', 'Factory').within(() => {
      cy.contains('.factory-recipe', 'Processor, class 1')
        .contains('button', 'Craft', { timeout: 15000 })
        .click({ timeout: 15000 })
      cy.contains('[role=status]', 'Crafting Processor, class 1', { timeout: 15000 })
      cy.contains('In production')
    })

    cy.task('finishFactoryJobs', { email })
    cy.contains('.game-window', 'Factory').within(() => {
      cy.contains('[role=tab]', 'Assemble').click()
      cy.contains('label', 'Processor, class 1').click()
      cy.get('input[aria-label="Name of the bot"]').type('Scout')
      cy.contains('button', 'Assemble a bot').click()
      // A processor alone is not a bot: the refusal is shown and the part stays
      cy.contains('[role=status]', 'It did not work')
      cy.contains('label', 'Processor, class 1')
    })
    cy.task<{ id: string }[]>('workersOf', { email }).should('have.length', 0)
  })

  it('does not offer to craft what the base cannot pay for', () => {
    cy.contains('.game-toolbar button', 'Factory').click()

    cy.contains('.game-window', 'Factory').within(() => {
      // 60 iron: more than the 50 of the starter resources (design §6.1)
      cy.contains('.factory-recipe', 'Factory, class 1').contains('button', 'Craft').should('be.disabled')
    })
  })
})
