import { newEmail, PASSWORD } from '../support/commands'

const NEW_PASSWORD = 'N3w$ecret!'

function openAccountPage(email: string, password = PASSWORD) {
  cy.loginViaForm(email, password)
  cy.location('pathname').should('eq', '/game')
  cy.visit('/account')
}

describe('account management', () => {
  it('resets a forgotten password through the emailed link', () => {
    const email = newEmail()
    cy.createPlayer(email)

    cy.visit('/auth')
    cy.contains('Forgot your password?').click()
    cy.get('input[type=email]').type(email)
    cy.contains('button', 'Send the link').click()
    cy.contains('If this address is registered, we have sent a link to it.')

    cy.emailedLink(email, 'Reset your password').then((link) => cy.visit(link))
    cy.get('input[type=password]').type(NEW_PASSWORD, { parseSpecialCharSequences: false })
    cy.contains('button', 'Save the password').click()
    cy.contains('The password was changed. Log in with the new one.')

    cy.loginViaForm(email, PASSWORD)
    cy.contains('.ant-notification', 'The email or the password is wrong')
    cy.loginViaForm(email, NEW_PASSWORD)
    cy.location('pathname').should('eq', '/game')
  })

  it('does not reset the password for an address nobody registered, and says the same', () => {
    cy.visit('/forgot-password')
    cy.get('input[type=email]').type(newEmail('nobody'))
    cy.contains('button', 'Send the link').click()

    cy.contains('If this address is registered, we have sent a link to it.')
  })

  it('shows that a reset link without a token is incomplete', () => {
    cy.visit('/reset-password')

    cy.contains('The link is incomplete.')
  })

  it('changes the password of a signed-in player', () => {
    const email = newEmail()
    cy.createPlayer(email)
    openAccountPage(email)

    cy.get('input[placeholder="Current password"]').type(PASSWORD, { parseSpecialCharSequences: false })
    cy.get('input[placeholder="New password"]').type(NEW_PASSWORD, { parseSpecialCharSequences: false })
    cy.contains('button', 'Change the password').click()
    cy.contains('.ant-notification', 'The password was changed. Your other devices were signed out.')

    cy.contains('button', 'Sign out').click()
    cy.loginViaForm(email, NEW_PASSWORD)
    cy.location('pathname').should('eq', '/game')
  })

  it('refuses a password change with a wrong current password', () => {
    const email = newEmail()
    cy.createPlayer(email)
    openAccountPage(email)

    cy.get('input[placeholder="Current password"]').type('Wr0ng$pass', { parseSpecialCharSequences: false })
    cy.get('input[placeholder="New password"]').type(NEW_PASSWORD, { parseSpecialCharSequences: false })
    cy.contains('button', 'Change the password').click()

    cy.contains('.ant-notification', 'The current password is wrong')
  })

  it('changes the email once the new mailbox confirmed it', () => {
    const email = newEmail()
    const newAddress = newEmail('moved')
    cy.createPlayer(email)
    openAccountPage(email)

    cy.get('input[placeholder="Password"]').first().type(PASSWORD, { parseSpecialCharSequences: false })
    cy.get('input[placeholder="New email"]').type(newAddress)
    cy.contains('button', 'Send the confirmation link').click()
    cy.contains('.ant-notification', 'We sent a confirmation link to the new address.')

    cy.emailedLink(newAddress, 'Confirm your new email').then((link) => cy.visit(link))
    cy.contains('Your email was changed. Log in again.')

    cy.loginViaForm(email)
    cy.contains('.ant-notification', 'The email or the password is wrong')
    cy.loginViaForm(newAddress)
    cy.location('pathname').should('eq', '/game')
  })

  it('shows that an email-change link is invalid when it is', () => {
    cy.visit('/confirm-email-change?token=not-a-real-token')

    cy.contains('The link is invalid or has expired.')
  })

  it('deletes the account after the emailed confirmation', () => {
    const email = newEmail()
    cy.createPlayer(email)
    openAccountPage(email)

    cy.get('input[placeholder="Password"]').last().type(PASSWORD, { parseSpecialCharSequences: false })
    cy.contains('button', 'Delete my account').click()
    cy.contains('.ant-notification', 'We sent a confirmation link to your email. Follow it to finish.')

    cy.emailedLink(email, 'Confirm account deletion').then((link) => cy.visit(link))
    cy.contains('Your account was deleted.')

    cy.loginViaForm(email)
    cy.contains('.ant-notification', 'The email or the password is wrong')
  })
})
