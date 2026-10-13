import { newEmail } from '../support/commands'

describe('the player documentation on the public pages', () => {
  it('is reached from the landing page, in both languages, with the language switch keeping the page', () => {
    cy.visit('/')
    cy.contains('.site-nav a', 'Docs').click()
    cy.location('pathname').should('eq', '/docs')
    cy.contains('h1', 'Bot RTS documentation')

    cy.contains('.docs-side a', 'Energy').click()
    cy.location('pathname').should('eq', '/docs/concepts/energy')
    cy.contains('h1', 'Energy')

    cy.contains('.site-languages a', 'Русский').click()
    cy.location('pathname').should('eq', '/ru/docs/concepts/energy')
    cy.contains('h1', 'Энергия')
    cy.get('html').should('have.attr', 'lang', 'ru')

    cy.contains('.site-languages a', 'English').click()
    cy.location('pathname').should('eq', '/docs/concepts/energy')
  })

  it('lists the script API from the code, and the modules and recipes from the balance config', () => {
    cy.visit('/docs/api')
    cy.contains('code', 'move(cells: number): Promise<Result<any>>')
    cy.contains('tr', 'sleep(ms: number)').should('contain', 'every bot')

    cy.visit('/docs/modules')
    cy.contains('tr', 'Drill, class 1').should('contain', 'Material per operation')
    cy.visit('/docs/recipes')
    cy.contains('tr', 'Scanner, class 1').should('contain', '20 Iron, 5 Crystal')
  })

  it('shows the example scripts, and the commands of BotOS', () => {
    cy.visit('/docs/examples')
    cy.contains('h2', 'Miner')
    cy.contains('pre', 'bot.dig()')

    cy.visit('/docs/botos')
    cy.contains('tr', 'craft <module> [count]')
  })

  it('searches the pages, and a search for something only the reference lists leads to it', () => {
    cy.visit('/docs')
    cy.get('input[type=search]').type('getLinkStatus')
    cy.contains('.docs-results a', 'Script API reference').click()

    cy.location('pathname').should('eq', '/docs/api')
    cy.get('input[type=search]').type('zzzzzz')
    cy.contains('Nothing found')
  })

  it('is in the sitemap in both languages, with alternates', () => {
    cy.request('/sitemap.xml').its('body').should('include', '/docs/api').and('include', '/ru/docs/api')
  })
})

describe('the Help window of the game', () => {
  beforeEach(() => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  const help = () => cy.contains('.game-window-title', 'Help').closest('.game-window')

  it('shows the documentation from the toolbar, with search, and its links stay in the window', () => {
    cy.contains('.game-toolbar button', 'Help').click()

    help().contains('h1', 'Bot RTS documentation')
    help().contains('a', 'Ticks').click()
    help().contains('h1', 'Ticks')
    cy.location('pathname').should('eq', '/game')

    help().find('input[type=search]').type('generator')
    help().contains('.docs-results a', 'Energy')
  })

  it('opens at the page a "?" of the factory points to', () => {
    cy.contains('.game-toolbar button', 'Factory').click()
    cy.contains('.game-window', 'Factory').find('button[aria-label="Open the help page"]').first().click()

    help().contains('h1', 'Your first bot')
  })

  it('opens at the page that help <topic> names in the terminal', () => {
    cy.get('input.terminal-input').type('help energy{enter}')

    cy.contains('Opening the help page: energy')
    help().contains('h1', 'Energy')

    cy.get('input.terminal-input').type('help nonsense{enter}')
    cy.contains('There is no help on')
  })

  it('opens the page of the script API from the editor of a file', () => {
    cy.get('input.terminal-input').type('cd memory-class1{enter}')
    cy.get('input.terminal-input').type('edit a.js{enter}')
    cy.get('.terminal-editor button[aria-label="Open the help page"]').first().click()

    help().contains('h1', 'Example scripts')
  })

  it('works without the network: the pages are part of the client', () => {
    cy.contains('.game-toolbar button', 'Help').click()
    cy.intercept('**', { forceNetworkError: true })

    help().contains('a', 'Energy').click()

    help().contains('h1', 'Energy')
  })

  it('brings the tutorial back', () => {
    cy.contains('.game-toolbar button', 'Help').click()
    help().contains('button', 'Show the tutorial again').click()

    cy.get('.tutorial-overlay').should('be.visible')
  })
})
