import { newEmail } from '../support/commands'

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
        cy.get('[data-testid=map] canvas').then(($canvas) => {
          cy.wrap($canvas).click(
            Math.floor($canvas[0].clientWidth / 2) + 6 * 32,
            Math.floor($canvas[0].clientHeight / 2) + 6 * 32
          )
        })
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

  it('crafts modules in the factory window, waits for the factory and assembles a bot from them', () => {
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
      for (const module of ['Processor, class 1', 'Wireless adapter, class 1', 'Battery, class 1']) {
        cy.contains('.factory-recipe', module).contains('button', 'Craft').click()
        cy.contains('[role=status]', `Crafting ${module}`)
      }
      cy.contains('In production')
    })

    cy.task('finishFactoryJobs', { email })
    cy.contains('.game-window', 'Factory').within(() => {
      cy.contains('[role=tab]', 'Assemble').click()
      cy.contains('label', 'Processor, class 1').click()
      cy.contains('label', 'Wireless adapter, class 1').click()
      cy.contains('label', 'Battery, class 1').click()
      cy.get('input[aria-label="Name of the bot"]').type('Scout')
      cy.contains('button', 'Assemble a bot').click()
      cy.contains('The bot is assembled')
    })

    cy.task<{ id: string; label: string }[]>('workersOf', { email }).should('have.length', 1)
  })

  it('does not offer to craft what the base cannot pay for', () => {
    cy.contains('.game-toolbar button', 'Factory').click()

    cy.contains('.game-window', 'Factory').within(() => {
      cy.contains('.factory-recipe', 'Gun, class 1').contains('button', 'Craft').should('be.disabled')
    })
  })
})
