import { newEmail } from '../support/commands'

const windowWith = (title: string) => cy.contains('.game-window-title', title).closest('.game-window')

function zIndexOf($window: JQuery<HTMLElement>) {
  return Number($window.css('z-index'))
}

describe('the windows of the game screen', () => {
  beforeEach(() => {
    cy.createPlayer(newEmail()).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  it('opens the terminal by itself, and the other windows from the toolbar', () => {
    windowWith('Terminal').should('be.visible')

    cy.contains('.game-toolbar button', 'Storage').click()
    windowWith('Storage').should('be.visible')
    cy.contains('.game-toolbar button', 'Factory').click()
    windowWith('Factory').should('be.visible')
    cy.contains('.game-toolbar button', 'Settings').click()
    windowWith('Settings').should('be.visible')
    cy.contains('.game-toolbar button', 'Control panel').click()
    windowWith('Control').should('be.visible')
  })

  it('brings the window that is pressed to the front, and opening an open window does the same', () => {
    cy.contains('.game-toolbar button', 'Storage').click()
    cy.contains('.game-toolbar button', 'Settings').click()

    windowWith('Settings').then(($settings) => {
      windowWith('Storage').should(($storage) => expect(zIndexOf($storage)).to.be.lessThan(zIndexOf($settings)))
    })

    windowWith('Storage').find('.game-window-body').trigger('pointerdown', { force: true })
    windowWith('Storage').then(($storage) => {
      windowWith('Settings').should(($settings) => expect(zIndexOf($settings)).to.be.lessThan(zIndexOf($storage)))
    })

    cy.contains('.game-toolbar button', 'Settings').click()
    windowWith('Settings').then(($settings) => {
      windowWith('Storage').should(($storage) => expect(zIndexOf($storage)).to.be.lessThan(zIndexOf($settings)))
    })
  })

  it('drags a window by its title and remembers where it was left after a reload', () => {
    windowWith('Terminal').then(($window) => {
      const before = $window[0].getBoundingClientRect()

      cy.contains('.game-window-title', 'Terminal')
        .trigger('pointerdown', 20, 10, { pointerId: 1, button: 0, force: true })
        .trigger('pointermove', 220, 110, { pointerId: 1, force: true })
        .trigger('pointerup', 220, 110, { pointerId: 1, force: true })

      windowWith('Terminal').should(($moved) => {
        const after = $moved[0].getBoundingClientRect()

        expect(after.left - before.left).to.equal(200)
        expect(after.top - before.top).to.equal(100)
      })
      windowWith('Terminal').then(($moved) => {
        const left = $moved[0].getBoundingClientRect().left

        cy.reload()
        cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
        windowWith('Terminal').should(($again) => expect($again[0].getBoundingClientRect().left).to.equal(left))
      })
    })
  })

  it('resizes a window with its corner and does not let it get smaller than a corner of the screen', () => {
    cy.contains('.game-toolbar button', 'Storage').click()

    windowWith('Storage').then(($window) => {
      const before = $window[0].getBoundingClientRect()

      cy.get('.game-window [data-testid=resize-handle]')
        .last()
        .trigger('pointerdown', 5, 5, { pointerId: 1, button: 0, force: true })
        .trigger('pointermove', 105, 55, { pointerId: 1, force: true })
        .trigger('pointerup', 105, 55, { pointerId: 1, force: true })

      windowWith('Storage').should(($resized) => {
        const after = $resized[0].getBoundingClientRect()

        expect(after.width - before.width).to.equal(100)
        expect(after.height - before.height).to.equal(50)
      })

      cy.get('.game-window [data-testid=resize-handle]')
        .last()
        .trigger('pointerdown', 5, 5, { pointerId: 1, button: 0, force: true })
        .trigger('pointermove', -3000, -3000, { pointerId: 1, force: true })
        .trigger('pointerup', -3000, -3000, { pointerId: 1, force: true })
      windowWith('Storage').should('have.css', 'width', '260px')
    })
  })

  it('closes a window and opens it again from the toolbar', () => {
    windowWith('Terminal').find('button[aria-label="Close window"]').click()
    cy.contains('.game-window-title', 'Terminal').should('not.exist')

    cy.contains('.game-toolbar button', 'Terminal').click()
    windowWith('Terminal').should('be.visible')
  })
})
