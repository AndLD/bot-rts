import { newEmail } from '../support/commands'

// The cell the inspector shows, as numbers
function inspectedCell(): Cypress.Chainable<{ x: number; y: number }> {
  return cy.contains('.map-inspector strong', /^Cell /).then(($strong) => {
    const [x, y] = /Cell (-?\d+), (-?\d+)/.exec($strong.text())!.slice(1).map(Number)

    return { x, y }
  })
}

const canvas = () => cy.get('[data-testid=map] canvas')

// A 32 px cell at zoom 1; the base is in the middle of the map when the game opens
const CELL = 32

describe('the map', () => {
  let email: string

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    // The terminal window lies over the middle of the map
    cy.get('button[aria-label="Close window"]').click()
    canvas().should(($canvas) => expect($canvas[0].clientWidth).to.be.greaterThan(500))
  })

  // The middle of the canvas in its own pixels
  const middle = (offsetCells = 0, offsetRows = 0) =>
    canvas().then(($canvas) => ({
      x: Math.floor($canvas[0].clientWidth / 2) + offsetCells * CELL,
      y: Math.floor($canvas[0].clientHeight / 2) + offsetRows * CELL
    }))

  const clickCell = (offsetCells = 0, offsetRows = 0) =>
    middle(offsetCells, offsetRows).then(({ x, y }) => canvas().click(x, y))

  it('shows the own base in the middle, opens its control panel and tells what the cell holds', () => {
    clickCell()

    cy.contains('.map-inspector', 'Your base')
    cy.contains('.map-inspector', 'Live now').should('not.exist')
    cy.contains('.game-window-title', 'Control')
    cy.contains('code', 'scan')
  })

  it('keeps what was never scanned black and shows it after a scan', () => {
    clickCell(1, 0)
    cy.contains('.map-inspector', 'Unknown: never scanned')

    clickCell()
    cy.contains('.game-window', 'Control').within(() => {
      cy.contains('code', 'scan').parent().contains('button', 'Do').click()
      cy.contains('[role=status]', 'Done')
    })

    clickCell(1, 0)
    cy.contains('.map-inspector', /Seen \d+ s ago/)
    cy.contains('.map-inspector', 'Unknown').should('not.exist')
  })

  // A drag across the map: the pointer goes down, moves and comes up; the pointer events of a synthesized drag are not capturable,
  // so the elements are triggered by force
  const drag = (fromX: number, fromY: number, byX: number) => {
    canvas()
      .trigger('pointerdown', fromX, fromY, { pointerId: 1, button: 0, force: true })
      .trigger('pointermove', fromX + byX, fromY, { pointerId: 1, force: true })
      .trigger('pointerup', fromX + byX, fromY, { pointerId: 1, force: true })
  }

  it('pans by dragging and reaches cells with negative coordinates', () => {
    clickCell()
    inspectedCell().then((start) => {
      // Dragging the map to the left shows cells further to the right
      middle().then(({ x, y }) => {
        drag(x, y, -2 * CELL)
        canvas().click(x, y)
      })
      inspectedCell().should('deep.equal', { x: start.x + 2, y: start.y })

      // Dragging far to the right shows cells with negative coordinates
      middle().then(({ x, y }) => {
        drag(x, y, 100 * CELL)
        canvas().click(x, y)
      })
      inspectedCell().its('x').should('be.lessThan', 0)
    })
  })

  it('zooms with the wheel: the same distance from the middle then reaches fewer cells', () => {
    clickCell()
    inspectedCell().then((start) => {
      // 20 px right of the middle of a cell of 32 px is in the next cell
      middle().then(({ x, y }) => canvas().click(x + 20, y))
      inspectedCell().should('deep.equal', { x: start.x + 1, y: start.y })

      middle().then(({ x, y }) => {
        for (let step = 0; step < 4; step++) {
          canvas().trigger('wheel', x, y, { deltaY: -100, force: true })
        }
        canvas().click(x + 20, y)
      })
      inspectedCell().should('deep.equal', start)
    })
  })

  it('draws something once a scan has shown a part of the world, and an effect for the scan', () => {
    clickCell()
    cy.contains('.game-window', 'Control').within(() => {
      cy.contains('code', 'scan').parent().contains('button', 'Do').click()
    })

    canvas().should(($canvas) => {
      const element = $canvas[0] as HTMLCanvasElement
      const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)
      const lit = data.reduce((count, value, index) => (index % 4 !== 3 && value > 0 ? count + 1 : count), 0)

      expect(lit).to.be.greaterThan(0)
    })
  })

  it("is the player's own: another player's map does not show this base", () => {
    cy.createPlayer(newEmail()).then(({ token: otherToken }) => {
      cy.deployBaseViaApi(otherToken).then(({ at }) => {
        cy.apiRequest({
          path: `/api/v1/map?minX=${at.x - 10}&minY=${at.y - 10}&maxX=${at.x + 10}&maxY=${at.y + 10}`,
          headers: { Authorization: `Bearer ${otherToken}` }
        })
          .its('body.cells')
          .should('have.length', 1)
      })
    })
  })
})
