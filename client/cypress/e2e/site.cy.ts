import { newEmail } from '../support/commands'

describe('the landing page', () => {
  it('presents the game and leads to the sign-up and to the login', () => {
    cy.visit('/')
    cy.contains('h1', 'Program your bots. Conquer the map.')
    cy.get('img.landing-poster').should('have.attr', 'src', '/poster.svg')

    cy.contains('.landing-actions a', 'Play for free').click()
    cy.location('pathname').should('eq', '/auth')
    cy.contains('h1', 'Sign Up')

    cy.visit('/')
    cy.contains('.site-nav a', 'Log in').click()
    cy.contains('h1', 'Login')
  })

  it('is in Russian under /ru, with the language switch keeping the page, and says so to search engines', () => {
    cy.visit('/ru')
    cy.get('html').should('have.attr', 'lang', 'ru')
    cy.contains('h1', 'Программируй ботов. Захвати карту.')
    cy.get('link[rel=alternate][hreflang=en]')
      .should('have.attr', 'href')
      .and('match', /^http:\/\/localhost:\d+\/?$/)
    cy.get('script[type="application/ld+json"]').should('exist')

    cy.contains('.site-languages a', 'English').click()
    cy.location('pathname').should('eq', '/')
    cy.contains('h1', 'Program your bots')
    cy.request('/robots.txt').its('body').should('include', 'Sitemap')
  })

  it('links the documentation and the privacy policy from the footer', () => {
    cy.visit('/')
    cy.contains('.site-footer a', 'Docs').click()
    cy.location('pathname').should('eq', '/docs')

    cy.visit('/')
    cy.contains('.site-footer a', 'Privacy policy').click()
    cy.location('pathname').should('eq', '/privacy')
    cy.contains('h1', 'Privacy policy')
    cy.contains('Terminal logs')
    cy.contains('We set no analytics, advertising or other non-essential cookies')
  })

  it('has the privacy policy in Russian, and a cookie notice that says nothing non-essential is set and is not shown again', () => {
    cy.visit('/ru/privacy')
    cy.contains('h1', 'Политика конфиденциальности')
    cy.contains('.cookie-notice', 'необязательные cookie отключены')
    cy.contains('.cookie-notice button', 'Понятно').click()
    cy.get('.cookie-notice').should('not.exist')

    cy.reload()
    cy.get('.cookie-notice').should('not.exist')
    cy.document().then((doc) => expect(doc.cookie).to.equal(''))
  })
})

describe('the authentication page', () => {
  it('stands the forms over the live scene, which moves', () => {
    cy.visit('/auth')
    cy.get('[data-testid=ambient-scene]').should('be.visible')
    cy.contains('.auth-card h1', 'Login')

    cy.get('[data-testid=ambient-scene]').then(($canvas) => {
      const first = ($canvas[0] as HTMLCanvasElement).toDataURL()
      cy.wait(2500)
      cy.get('[data-testid=ambient-scene]').should(($next) => {
        expect(($next[0] as HTMLCanvasElement).toDataURL()).not.to.equal(first)
      })
    })
  })

  it('shows one still picture when the system asks for less motion', () => {
    cy.visit('/auth', {
      onBeforeLoad(win) {
        cy.stub(win, 'matchMedia').callsFake((query: string) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined
        }))
      }
    })
    cy.get('[data-testid=ambient-scene]').should('be.visible')

    cy.wait(1000)
    cy.get('[data-testid=ambient-scene]').then(($canvas) => {
      const first = ($canvas[0] as HTMLCanvasElement).toDataURL()
      cy.wait(2000)
      cy.get('[data-testid=ambient-scene]').then(($next) => {
        expect(($next[0] as HTMLCanvasElement).toDataURL()).to.equal(first)
      })
    })
  })

  it('has a link back to the landing page and a language choice', () => {
    cy.visit('/auth')
    cy.contains('.auth-top a', 'Bot RTS').should('have.attr', 'href', '/')
    cy.get('.auth-top .ant-select').click()
    cy.contains('.ant-select-item', 'Русский').click()
    cy.contains('.auth-card h1', 'Вход')
  })

  it('translates the errors of the server and the answers of the terminal into the language of the player', () => {
    const email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', {
        onBeforeLoad: (win) => {
          win.localStorage.setItem('token', token)
          win.localStorage.setItem('locale', 'ru')
        }
      })
    })
    cy.contains('# Добро пожаловать в BotOS Alpha 0.1.0 #')
    cy.get('input.terminal-input').type('nosuchcommand{enter}')
    cy.contains('Неизвестная команда')
    cy.get('input.terminal-input').type('help{enter}')
    cy.contains('список команд')
  })
})
