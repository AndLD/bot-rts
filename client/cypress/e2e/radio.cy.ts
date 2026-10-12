import { newEmail } from '../support/commands'

const BOT_KIT = ['processor-class1', 'wireless-adapter-class1', 'battery-class1']
const CELL = 32

describe('the radio link of a bot on the map', () => {
  let token: string
  let baseId: string
  let base: { x: number; y: number }

  beforeEach(() => {
    const email = newEmail()
    cy.createPlayer(email).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token).then((deployed) => {
        baseId = deployed.id
        base = deployed.at
      })
    })
    cy.then(() => cy.assembleWorker({ email, token, baseId, modules: BOT_KIT, label: 'Walker' })).as('botId')
  })

  // Opens the game with the bot four cells east of the base, and the terminal window out of the way of the map
  function openGame() {
    cy.get<string>('@botId').then((botId) => {
      cy.task('placeBotAt', { botId, x: base.x + 4, y: base.y })
    })
    cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('button[aria-label="Close window"]').click()
  }

  const clickCellEastOfBase = (cells: number) =>
    cy.get('[data-testid=map] canvas').then(($canvas) => {
      cy.wrap($canvas).click(
        Math.floor($canvas[0].clientWidth / 2) + cells * CELL,
        Math.floor($canvas[0].clientHeight / 2)
      )
    })

  it('shows weaker signal bars as the bot walks away from the base, and hatches it when the link is lost', () => {
    openGame()

    // The link changes: the bot is now 19 cells from the base, at the edge of the range of 20
    cy.get<string>('@botId').then((botId) => {
      cy.teleportBot({ token, baseId, botId, x: base.x + 19, y: base.y })
    })
    // The map still shows the bot where it was; the radio tells how well it is heard now
    clickCellEastOfBase(4)
    cy.contains('.map-inspector', 'Your bot')
    cy.contains('.map-inspector', /Signal: [123] of 4/)

    cy.get<string>('@botId').then((botId) => {
      cy.teleportBot({ token, baseId, botId, x: base.x + 60, y: base.y })
    })
    cy.contains('.map-inspector', /Connection lost \d+ s ago/)
  })
})
