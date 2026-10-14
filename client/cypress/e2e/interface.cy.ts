import { newEmail } from '../support/commands'

const scroller = '[data-testid=terminal-scroll]'

describe('the control window', () => {
  let token: string
  let baseId: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token).then((deployed) => (baseId = deployed.id))
    })
  })

  const openControl = (layouts: object = {}) => {
    cy.visit('/game', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', token)
        win.localStorage.setItem('windows-layout', JSON.stringify(layouts))
      }
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.contains('.game-toolbar button', 'Control').click()

    return cy.contains('.game-window-title', 'Control').closest('.game-window')
  }

  it('opens wide, so that the inputs can be read', () => {
    openControl().invoke('outerWidth').should('be.gte', 640)
    cy.get('.control-panel input').first().invoke('outerWidth').should('be.gte', 100)
  })

  it('widens a window that an older version saved narrow', () => {
    cy.then(() =>
      openControl({ [`control:${baseId}`]: { x: 40, y: 60, width: 480, height: 520 } }).invoke('outerWidth')
    ).should('be.gte', 640)
  })
})

describe('the terminal while a script writes to it', () => {
  let token: string
  let baseId: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token).then((deployed) => {
        baseId = deployed.id
        // A line every 100 ms for seven seconds (a script may write twenty lines in a tick)
        cy.writeScriptFile({
          token,
          botId: baseId,
          path: 'job.js',
          content:
            'export async function main(bot) { for (let i = 0; i < 70; i++) { bot.log("line " + i); await bot.sleep(100) } }'
        })
      })
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('input.terminal-input').first().type('cd memory-class1{enter}')
    cy.get('input.terminal-input').first().type('run job.js{enter}')
    cy.contains('line 25', { timeout: 15000 })
  })

  const isAtBottom = ($element: JQuery<HTMLElement>) => {
    const element = $element[0]

    return element.scrollHeight - element.scrollTop - element.clientHeight <= 4
  }

  it('follows the new lines, leaves a reader who scrolled up alone, and follows again at the bottom', () => {
    cy.get(scroller).should(($element) => expect(isAtBottom($element)).to.equal(true))

    cy.get(scroller).scrollTo('top')
    cy.get(scroller)
      .then(($element) => $element[0].scrollHeight)
      .then((height) => {
        // More lines have arrived, and the reader was not pulled down
        cy.get(scroller, { timeout: 8000 }).should(($element) =>
          expect($element[0].scrollHeight).to.be.greaterThan(height)
        )
        cy.get(scroller).should(($element) => expect($element[0].scrollTop).to.be.lessThan(40))
      })

    cy.get(scroller).scrollTo('bottom')
    cy.get(scroller).should(($element) => expect(isAtBottom($element)).to.equal(true))
    cy.contains('line 69', { timeout: 20000 })
    cy.get(scroller).should(($element) => expect(isAtBottom($element)).to.equal(true))
  })
})
