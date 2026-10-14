import { newEmail } from '../support/commands'

const clock = '[data-testid=game-clock]'
const filter = '[data-testid=night-filter]'
const canvas = () => cy.get('[data-testid=map] canvas')

// How many colour values of the canvas are not black
const litValues = (element: HTMLCanvasElement) => {
  const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)

  return data.reduce((count, value, index) => (index % 4 !== 3 && value > 0 ? count + 1 : count), 0)
}

describe('the day and night', () => {
  beforeEach(() => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    // The terminal window lies over the middle of the map
    cy.get('button[aria-label="Close window"]').click()
    canvas().should(($canvas) => expect($canvas[0].clientWidth).to.be.greaterThan(500))
    canvas().should(($canvas) => expect(litValues($canvas[0] as HTMLCanvasElement)).to.be.greaterThan(0))
  })

  it('shows the in-game time and the part of the day, and the time moves', () => {
    cy.get(clock).contains(/^\d\d:\d\d · (Night|Morning|Day|Evening)$/)

    // An in-game minute is a real second
    cy.get(clock)
      .invoke('text')
      .then((before) => {
        cy.get(clock, { timeout: 8000 }).should(($clock) => expect($clock.text()).not.to.equal(before))
      })
  })

  it('lays a filter over the map that lets the clicks through to the cells', () => {
    cy.get(filter).should('exist').and('have.css', 'pointer-events', 'none')
    cy.get(filter).parent().should('have.attr', 'data-testid', 'map')

    canvas().then(($canvas) =>
      canvas().click(Math.floor($canvas[0].clientWidth / 2), Math.floor($canvas[0].clientHeight / 2))
    )

    cy.contains('.map-inspector', 'Your base')
    cy.contains('.game-window-title', 'Control')
  })
})
