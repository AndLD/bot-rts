import { eventually, newEmail } from '../support/commands'

function command(text: string) {
  cy.get('input.terminal-input').first().type(text, { parseSpecialCharSequences: false }).type('{enter}')
}

function writeFile(name: string, content: string) {
  command(`edit ${name}`)
  cy.contains(`Editing ${name}`)
  cy.get('textarea').type(content, { parseSpecialCharSequences: false, delay: 0 })
  cy.contains('button', 'Save').click()
  cy.contains(`Saved ${name}`)
}

// Asks the API again until the answer is what the test waits for: what the engine and the consumers of its events do is done a moment
// after the player acts
function poll<T>(token: string, path: string, isDone: (body: T) => boolean): Cypress.Chainable<T> {
  return eventually(
    () =>
      cy
        .apiRequest({ path, headers: { Authorization: `Bearer ${token}` } })
        .its('body') as unknown as Cypress.Chainable<T>,
    isDone,
    60
  )
}

const windowWith = (title: string) => cy.contains('.game-window-title', title).closest('.game-window')

describe('achievements', () => {
  let token: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
    })
  })

  const openGame = () => {
    cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  }

  it('unlocks one as the player earns it, with a toast, and lists it on the achievements page', () => {
    cy.deployBaseViaApi(token)
    openGame()
    command('cd memory-class1')
    writeFile('hello.js', 'export async function main(bot) { bot.log("hi") }')

    command('run hello.js')

    cy.contains('.ant-notification', 'Achievement unlocked', { timeout: 15000 })
    cy.contains('.ant-notification', 'Hello, world')
    cy.contains('.game-toolbar button', 'Achievements').click()
    windowWith('Achievements').within(() => {
      cy.contains('Hello, world').closest('li').should('have.class', 'is-earned')
      cy.contains('Run a first script')
      cy.contains('Prospector I').closest('li').should('not.have.class', 'is-earned')
      cy.contains('0 / 100')
    })
  })

  it('counts what was earned while the player was away, and tells of it when they are back', () => {
    // Nobody is looking: the base is deployed through the API, and its achievement is earned all the same
    cy.deployBaseViaApi(token)
    poll<Array<{ id: string; unlockedAt: number | null }>>(token, '/api/v1/achievements', (list) =>
      list.some((item) => item.id === 'firstSteps' && item.unlockedAt !== null)
    )

    openGame()

    cy.contains('.ant-notification', 'While you were away')
    cy.contains('.ant-notification', '1 event, 1 achievement')
    cy.contains('.game-toolbar button', 'Achievements').click()
    windowWith('Achievements').contains('First steps').closest('li').should('have.class', 'is-earned')
    cy.contains('.game-toolbar button', 'Notifications').click()
    windowWith('Notifications').contains('Achievement unlocked: First steps')
  })

  it('shows the badges the player earned on the account page', () => {
    cy.deployBaseViaApi(token)
    cy.visit('/account', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })

    cy.contains('.ant-card', 'Achievements').contains('First steps')
  })
})

describe('notifications', () => {
  let token: string

  beforeEach(() => {
    cy.createPlayer(newEmail()).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
    command('cd memory-class1')
    writeFile('job.js', 'export async function main(bot) { bot.log("done") }')
  })

  type Notifications = { unread: number; items: Array<{ kind: string; count: number; readAt: number | null }> }
  const list = (isDone: (body: Notifications) => boolean = () => true) =>
    poll<Notifications>(token, '/api/v1/notifications', isDone)

  it('tells in real time, keeps it in the notification center with the unread count, and marks it read', () => {
    command('run job.js')

    cy.contains('.ant-notification', 'Scripts', { timeout: 15000 })
    cy.contains('.ant-notification', 'has finished')
    cy.contains('.game-toolbar .ant-badge', /^Notifications/)
      .find('sup')
      .should('be.visible')

    cy.contains('.game-toolbar button', 'Notifications').click()
    windowWith('Notifications').within(() => {
      cy.contains(/\d+ unread/)
      cy.contains('Scripts').closest('li').should('have.class', 'is-unread').find('button').click()
      cy.contains('Scripts').closest('li').should('not.have.class', 'is-unread')
    })
  })

  it('coalesces the same thing happening again into one notification with a count', () => {
    command('run job.js')
    command('run job.js')
    command('run job.js')

    list((body) => body.items.some((item) => item.kind === 'scriptFinished' && item.count === 3)).should(
      ({ items }) => {
        const finished = items.filter((item) => item.kind === 'scriptFinished')
        expect(finished).to.have.length(1)
        expect(finished[0].count).to.equal(3)
      }
    )
    cy.contains('.game-toolbar button', 'Notifications').click()
    windowWith('Notifications').contains('×3')
  })

  it('marks all as read, and lets the player switch a category off in the settings', () => {
    command('run job.js')
    list((body) => body.unread > 0)

    cy.contains('.game-toolbar button', 'Notifications').click()
    windowWith('Notifications').contains('button', 'Mark all as read').click()
    list((body) => body.unread === 0)
      .its('unread')
      .should('equal', 0)

    cy.contains('.game-toolbar button', 'Settings').click()
    windowWith('Settings').find('[aria-label="Notify about Scripts"]').click()
    poll<{ categories: { scripts: boolean } }>(
      token,
      '/api/v1/notifications/preferences',
      (body) => !body.categories.scripts
    )

    // Nothing is made for a category that is off, even when a script finishes
    cy.get('input.terminal-input').first().type('run job.js{enter}', { force: true })
    cy.contains('done')
    cy.wait(1500)
    list().should(({ items }) =>
      expect(items.filter((item) => item.kind === 'scriptFinished' && item.readAt === null)).to.have.length(0)
    )
  })
})

describe('a wrong password on a bot', () => {
  it('is told to the owner of the bot, once for the attempts that follow each other', () => {
    // Both bases are near each other (one spawn seed) and the bot stands between them: within the radio range of both, so the owner
    // hears of what happens to it and the other player can reach it
    const seed = `E2E-${Date.now().toString(36).toUpperCase()}${Cypress._.random(100, 999)}`
    const owner = newEmail()
    let ownerToken = ''
    let botId = ''

    cy.createPlayer(owner).then(({ token }) => {
      ownerToken = token
      cy.deployBaseViaApi(token, { spawnSeed: seed }).then(({ id: baseId, at: ownerBase }) => {
        cy.assembleWorker({
          email: owner,
          token,
          baseId,
          modules: ['processor-class1', 'wireless-adapter-class1', 'battery-class1'],
          label: 'Guarded'
        }).then((id) => {
          botId = id
          cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
          cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
          command(`connect ${id}`)
          cy.contains('.game-window', `Terminal ${id.slice(0, 8)}`).within(() => {
            cy.get('input.terminal-input').type('passwd correct1{enter}')
            cy.contains('password changed')
          })

          cy.createPlayer(newEmail()).then(({ token: intruderToken }) => {
            cy.deployBaseViaApi(intruderToken, { spawnSeed: seed }).then(({ at: intruderBase }) => {
              cy.teleportBot({
                token,
                baseId,
                botId: id,
                x: Math.round((ownerBase.x + intruderBase.x) / 2),
                y: Math.round((ownerBase.y + intruderBase.y) / 2)
              })
              cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', intruderToken) })
              cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
              command(`connect ${id} wrong1`)
              cy.contains('Error: The password is wrong')
              command(`connect ${id} wrong2`)
            })
          })
        })
      })
    })

    cy.then(() =>
      poll<{ items: Array<{ category: string; kind: string; count: number; botId: string }> }>(
        ownerToken,
        '/api/v1/notifications',
        ({ items }) => items.some((item) => item.kind === 'passwordFailed' && item.count === 2)
      ).should(({ items }) => {
        const failed = items.filter((item) => item.kind === 'passwordFailed')
        expect(failed).to.have.length(1)
        expect(failed[0]).to.include({ category: 'security', botId })
      })
    )
  })
})
