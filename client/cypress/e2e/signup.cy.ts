import { newEmail, PASSWORD } from '../support/commands'

function fillSignup(email: string, password = PASSWORD, name = 'Jon', acceptsPrivacy = true) {
  cy.visit('/auth')
  cy.contains("Don't have an account? Sign up").click()
  cy.get('input[placeholder="Name"]').type(name)
  cy.get('input[type=email]').type(email)
  cy.get('input[type=password]').type(password, { parseSpecialCharSequences: false })
  if (acceptsPrivacy) {
    cy.get('input[type=checkbox]').check()
  }
  cy.contains('button', 'Sign up').click()
}

describe('sign up and email verification', () => {
  it('signs up, is held back until the email is verified, then plays', () => {
    const email = newEmail()

    fillSignup(email)
    cy.location('pathname').should('eq', '/forbidden')
    cy.contains('Check your email. We have sent a verification letter')

    // Whatever page the unverified player opens, the inactive page is shown
    cy.visit('/game')
    cy.location('pathname').should('eq', '/forbidden')

    cy.emailedLink(email, 'Confirm your email').then((link) => cy.visit(link))
    cy.location('pathname').should('eq', '/auth')

    cy.loginViaForm(email)
    cy.location('pathname').should('eq', '/game')
  })

  it('sends the verification letter again on request', () => {
    const email = newEmail()
    fillSignup(email)
    cy.location('pathname').should('eq', '/forbidden')
    cy.emailedLink(email, 'Confirm your email')

    cy.get('input[type=email]').type(email)
    cy.contains('button', 'Send the letter again').click()

    cy.task('mailCount', { to: email }).should('eq', 2)
  })

  it('refuses an email that is already registered', () => {
    const email = newEmail()
    cy.createPlayer(email)

    fillSignup(email)

    cy.contains('.ant-notification', 'This email is already registered')
    cy.location('pathname').should('eq', '/auth')
  })

  it('needs the privacy policy accepted, and links it', () => {
    cy.intercept('POST', '**/api/v1/auth/register').as('register')

    fillSignup(newEmail(), PASSWORD, 'Jon', false)

    cy.contains('Please accept the privacy policy to sign up')
    cy.get('@register.all').should('have.length', 0)
    cy.contains('a', 'privacy policy').should('have.attr', 'href', '/privacy')
  })

  it('refuses a weak password before asking the server', () => {
    cy.intercept('POST', '**/api/v1/auth/register').as('register')

    fillSignup(newEmail(), 'weak')

    cy.contains('The password must have 6-20 characters')
    cy.get('@register.all').should('have.length', 0)
  })

  it('does not accept a verification link that has expired', () => {
    const email = newEmail()
    cy.register(email)
    cy.emailedLink(email, 'Confirm your email').then((link) => {
      cy.task('expireLinks', { email })
      cy.visit(link)
    })

    cy.contains('.ant-notification', 'Email confirmation failed')
    cy.location('pathname').should('eq', '/auth')

    // The login itself is refused until the email is confirmed
    cy.loginViaForm(email)
    cy.contains('.ant-notification', 'Confirm your email first')
    cy.location('pathname').should('eq', '/auth')
  })

  it('does not accept a verification link twice', () => {
    const email = newEmail()
    cy.register(email)
    cy.emailedLink(email, 'Confirm your email').then((link) => {
      cy.visit(link)
      cy.location('pathname').should('eq', '/auth')
      cy.visit(link)
    })

    cy.contains('.ant-notification', 'Email confirmation failed')
  })
})
