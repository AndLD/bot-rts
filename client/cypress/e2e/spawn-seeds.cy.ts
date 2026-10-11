import { Cell, newEmail } from '../support/commands'

// The distance two bases keep (Chebyshev, as the game measures it)
const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

// A seed code of its own for every test, so that tests never share a seed
const newSeed = () => `E2E-${Date.now().toString(36).toUpperCase()}${Cypress._.random(100, 999)}`

function openGame(token: string) {
  cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
}

// Fills the deploy dialog with a password and a seed and confirms it
function deployWithSeed(seed: string) {
  cy.get('input[type=password]').first().type('secret1')
  cy.get('input[type=password]').last().type('secret1')
  cy.get('input[autocomplete=off]:not([type=password])').type(seed)
  cy.get('button[type=submit]').click()
  cy.contains('.ant-modal button', 'Deploy').click()
}

describe('spawn seeds', () => {
  it('start players with the same code near each other and keep strangers away', () => {
    const seed = newSeed()
    cy.createPlayer(newEmail()).then(({ token: first }) => {
      cy.createPlayer(newEmail()).then(({ token: second }) => {
        cy.createPlayer(newEmail()).then(({ token: stranger }) => {
          cy.deployBaseViaApi(first, { spawnSeed: seed }).then((one) => {
            cy.deployBaseViaApi(second, { spawnSeed: seed.toLowerCase() }).then((two) => {
              cy.deployBaseViaApi(stranger).then((other) => {
                expect(distance(one.at, two.at)).to.be.at.most(12)
                expect(distance(one.at, other.at)).to.be.at.least(30)
                expect(distance(two.at, other.at)).to.be.at.least(30)
              })
            })
          })
        })
      })
    })
  })

  it('refuse a player once the seed is full', () => {
    const seed = newSeed()
    cy.createPlayer(newEmail()).then(({ token: first }) => cy.deployBaseViaApi(first, { spawnSeed: seed }))
    cy.createPlayer(newEmail()).then(({ token: second }) => cy.deployBaseViaApi(second, { spawnSeed: seed }))

    cy.createPlayer(newEmail()).then(({ token }) => {
      openGame(token)
      cy.contains('h2', 'Deploy your base')
      deployWithSeed(seed)

      cy.contains('This spawn seed is full')
      cy.contains('h2', 'Deploy your base')
    })
  })

  it('refuse a player once the seed has expired', () => {
    const seed = newSeed()
    cy.createPlayer(newEmail()).then(({ token: first }) => cy.deployBaseViaApi(first, { spawnSeed: seed }))
    cy.task('ageSpawnSeed', { code: seed })

    cy.createPlayer(newEmail()).then(({ token }) => {
      openGame(token)
      cy.contains('h2', 'Deploy your base')
      deployWithSeed(seed)

      cy.contains('This spawn seed is closed')
    })
  })

  it('are written in the deploy dialog like the rest, and a malformed code is refused before asking', () => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      openGame(token)
      cy.get('input[type=password]').first().type('secret1')
      cy.get('input[type=password]').last().type('secret1')
      cy.get('input[autocomplete=off]:not([type=password])').type('x')
      cy.get('button[type=submit]').click()

      cy.contains('3-24 letters, digits or dashes')
      cy.contains('Deploy your base?').should('not.exist')
    })
  })
})
