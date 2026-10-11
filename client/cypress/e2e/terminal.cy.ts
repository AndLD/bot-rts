import { newEmail } from '../support/commands'

// Opens the game as the player: the access token is what the client keeps in the browser
function openGame(token: string) {
  cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
}

function command(text: string) {
  cy.get('input.terminal-input').type(`${text}{enter}`)
}

describe('terminal', () => {
  it('cannot connect before a base is deployed', () => {
    cy.createPlayer(newEmail()).then(({ token }) => openGame(token))

    cy.contains('Failed to connect')
  })

  describe('with a deployed base', () => {
    beforeEach(() => {
      cy.createPlayer(newEmail()).then(({ token }) => {
        cy.apiRequest({
          method: 'POST',
          path: '/api/v1/bots/base',
          headers: { Authorization: `Bearer ${token}` }
        })
        openGame(token)
      })
      cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    })

    it('lists the bots of the player, the base being the current one', () => {
      command('list')

      cy.contains('(current) id="')
      cy.contains('type="base"')
    })

    it('lists the modules of the base', () => {
      command('modules')

      cy.contains('type="')
      cy.contains('name="')
    })

    it('lists the commands with help', () => {
      command('help')

      cy.contains('cd <path> - change the drive or the directory')
      cy.contains('exit - sign out')
    })

    it('says that files need a drive', () => {
      command('mkdir scripts')

      cy.contains('No drive selected')
    })

    it('answers an unknown command and clears the screen', () => {
      command('frobnicate')
      cy.contains('Unknown command')

      command('clear')
      cy.contains('Unknown command').should('not.exist')
    })

    it('enters the shell and leaves it again', () => {
      command('shell')
      cy.contains('Bot shell v0.0.1')
      cy.contains('>>>')

      command('exit')
      cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
      cy.location('pathname').should('eq', '/game')
    })

    it('signs the player out with exit', () => {
      command('exit')

      cy.location('pathname').should('eq', '/auth')
    })
  })
})
