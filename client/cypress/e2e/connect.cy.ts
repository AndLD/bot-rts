import { newEmail } from '../support/commands'

const BOT_KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']

function command(text: string) {
  cy.get('input.terminal-input').first().type(`${text}{enter}`)
}

describe('connecting to a bot from the terminal of the base', () => {
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

  it('opens a terminal window of its own for the bot, which leaves with exit while the base stays', () => {
    cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Scout' }).then((botId) => {
      command(`connect ${botId}`)

      cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`)
      cy.contains('.game-window', `Terminal ${botId.slice(0, 8)}`).within(() => {
        cy.get('input.terminal-input').type('modules{enter}')
        cy.contains('processor-class1')
        cy.get('input.terminal-input').type('exit{enter}')
      })
      cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`).should('not.exist')
      cy.contains('.game-window-title', /^Terminal$/)
    })
  })

  it('does not reach a bot that is out of the radio range of its base, and does when it is back', () => {
    cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Far' }).then((botId) => {
      // The adapter of class 1 reaches 20 cells
      cy.teleportBot({ token, baseId, botId, x: base.x + 60, y: base.y })

      command(`connect ${botId}`)
      cy.contains('Error:')
      cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`).should('not.exist')

      cy.teleportBot({ token, baseId, botId, x: base.x + 5, y: base.y })
      command(`connect ${botId}`)
      cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`)
    })
  })

  it('reaches a bot through a relay: another bot of the player that lies between it and the base', () => {
    cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Relay' }).then((relayId) => {
      cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Far' }).then((farId) => {
        // 15 cells apart is within the 20 cells of an adapter, 30 cells from the base is not
        cy.teleportBot({ token, baseId, botId: relayId, x: base.x + 15, y: base.y })
        cy.teleportBot({ token, baseId, botId: farId, x: base.x + 30, y: base.y })

        command(`connect ${farId}`)
        cy.contains('.game-window-title', `Terminal ${farId.slice(0, 8)}`)
        cy.contains('.game-window', `Terminal ${farId.slice(0, 8)}`)
          .find('button[aria-label="Close window"]')
          .click()

        // Without the relay in between the bot is out of reach
        cy.teleportBot({ token, baseId, botId: relayId, x: base.x + 15, y: base.y + 60 })
        command(`connect ${farId}`)
        cy.contains('Error:')
      })
    })
  })

  it('tells the terminal of a bot that the link is lost, and goes on when it is back', () => {
    cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Walker' }).then((botId) => {
      command(`connect ${botId}`)
      const title = `Terminal ${botId.slice(0, 8)}`
      cy.contains('.game-window-title', title)

      cy.teleportBot({ token, baseId, botId, x: base.x + 60, y: base.y })
      cy.contains('.game-window', title).within(() => {
        cy.contains('[role=alert]', 'Connection interrupted')
        cy.get('input.terminal-input').should('be.disabled')
      })

      cy.teleportBot({ token, baseId, botId, x: base.x + 5, y: base.y })
      cy.contains('.game-window', title).within(() => {
        cy.contains('Connection restored')
        cy.get('input.terminal-input').should('be.enabled').type('modules{enter}')
        cy.contains('processor-class1')
      })
    })
  })
})

// A bot of one player next to the base of another, with an access password of its own (design §11.2.2)
describe('connecting to the bot of another player', () => {
  let botId: string
  let otherEmail: string

  // The first player sets the password of a bot of theirs; the second player stands next to it with their base
  beforeEach(() => {
    const email = newEmail()
    otherEmail = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ id: baseId }) => {
        cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Guarded' }).then((id) => {
          botId = id
          cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
          cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
          command(`connect ${id}`)
          cy.contains('.game-window', `Terminal ${id.slice(0, 8)}`).within(() => {
            cy.get('input.terminal-input').type('passwd correct1{enter}')
            cy.contains('password changed')
          })
        })
      })
    })

    cy.createPlayer(otherEmail).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ at }) => {
        cy.task('placeBotAt', { botId, x: at.x + 3, y: at.y })
        cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
      })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  it('asks for the password, and takes the bot into the base with adopt', () => {
    command(`connect ${botId} wrong1`)
    cy.contains('Error: The password is wrong')

    command(`connect ${botId} correct1`)
    cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`)
    cy.contains('.game-window', `Terminal ${botId.slice(0, 8)}`).within(() => {
      cy.get('input.terminal-input').type('adopt{enter}')
      cy.contains('the bot is yours now')
    })
    cy.task<{ id: string }[]>('workersOf', { email: otherEmail }).should('have.length', 1)
  })

  it('locks the bot out after too many wrong passwords, even for the right one', () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      command(`connect ${botId} wrong${attempt}`)
    }
    cy.contains('Error: The password is wrong')

    command(`connect ${botId} correct1`)
    cy.contains('Error: The bot refuses connections for now')
    cy.contains('.game-window-title', `Terminal ${botId.slice(0, 8)}`).should('not.exist')
  })
})
