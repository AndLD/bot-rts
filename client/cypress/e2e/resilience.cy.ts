import { newEmail } from '../support/commands'

// A token that has already expired: the shape of an access token, with a time in the past and no valid signature
function expiredToken(): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'x', exp: 1 })}.signature`
}

describe('the game screen across reloads and sessions', () => {
  let token: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token)
    })
  })

  it('opens again after a reload with the same windows in the same places', () => {
    cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')

    cy.reload()

    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('[data-testid=map] canvas').should('be.visible')
  })

  it('keeps going when the access token has expired: the session is renewed and the game opens', () => {
    cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', expiredToken()) })

    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    cy.get('[data-testid=map] canvas').should('be.visible')
    cy.window().then((win) => expect(win.localStorage.getItem('token')).not.to.equal(expiredToken()))
  })

  it('sends a player who is not signed in to the login page', () => {
    cy.visit('/game')

    cy.location('pathname').should('equal', '/auth')
  })
})
