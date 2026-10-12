import { newEmail } from '../support/commands'

function command(text: string) {
  cy.get('input.terminal-input').type(`${text}{enter}`)
}

// The ids in the newest stored output that lists `<noun> id="…"` lines
function idsOf(email: string, noun: string): Cypress.Chainable<string[]> {
  return cy.task<string[]>('terminalLines', { email }).then((lines) => {
    const listing = [...lines].reverse().find((line) => line.startsWith('output: ') && line.includes(`${noun} id="`))

    return [...(listing ?? '').matchAll(/id="([^"]+)"/g)].map((match) => match[1])
  })
}

const STOCK = [
  { resource: 'iron', amount: 600 },
  { resource: 'crystal', amount: 400 },
  { resource: 'gold', amount: 100 },
  { resource: 'oil', amount: 50 }
]

describe('the factory of the base in the terminal', () => {
  let email: string

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token)
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  // Crafts the core modules of a bot, lets the factory finish and assembles the bot next to the base
  function assembleScout() {
    cy.task('stockBase', { email, items: STOCK })
    for (const module of ['processor-class1', 'wireless-adapter-class1', 'battery-class1']) {
      command(`craft ${module}`)
      cy.contains(`queued 1 x ${module}`)
    }
    cy.task('finishFactoryJobs', { email })
    command('clear')
    command('factory')
    cy.contains('- part id="')

    idsOf(email, 'part').then((ids) => {
      expect(ids).to.have.length(3)
      command(`assemble Scout ${ids.join(' ')}`)
    })
    cy.contains('assembled bot id="')
  }

  it('lists the recipes and refuses to craft without resources', () => {
    command('recipes')
    cy.contains('module="scanner-class1" known')
    cy.contains('module="scanner-class2" researchable')

    command('craft wheels-class1')
    cy.contains('Error: Not enough resources')
  })

  it('crafts modules, waits for the factory and assembles a bot next to the base', () => {
    assembleScout()

    command('list')
    cy.contains('label="Scout"')
    cy.task<{ id: string }[]>('workersOf', { email }).should('have.length', 1)

    command('clear')
    command('factory')
    cy.contains('/>').should('exist')
    cy.contains('- part id="').should('not.exist')
  })

  it('refuses to assemble a bot without a wireless adapter and a battery', () => {
    cy.task('stockBase', { email, items: STOCK })
    command('craft processor-class1')
    // The order is queued by the engine at its next tick, so wait for it before the factory is hurried along
    cy.contains('queued 1 x processor-class1')
    cy.task('finishFactoryJobs', { email })
    command('factory')
    cy.contains('- part id="')

    idsOf(email, 'part').then(([id]) => command(`assemble Lonely ${id}`))

    cy.contains('Error: The bot has no module for this')
    command('factory')
    cy.contains('module="processor-class1"')
  })

  it('repairs and then takes apart a module of the bot next to the base', () => {
    assembleScout()
    cy.task('addRepairModule', { email })

    cy.task<{ id: string }[]>('workersOf', { email }).then(([scout]) => {
      cy.task<string>('damageModule', { botId: scout.id, type: 'processor', condition: 50 }).then((moduleId) => {
        command(`repair ${scout.id} ${moduleId}`)
        cy.contains('repaired processor-class1: condition 75/100')

        // The repair module needs a second to recover
        cy.wait(1200)
        command(`disassemble ${scout.id} ${moduleId}`)
        cy.contains('disassembled, scrap: ')
      })
    })
    command('list')
    cy.contains('label="Scout"')
  })

  it('researches a blueprint and learns one found on the way', () => {
    cy.task('stockBase', { email, items: STOCK })

    command('research scanner-class2')
    cy.contains('researching scanner-class2')
    cy.task('finishFactoryJobs', { email })
    command('recipes')
    cy.contains('module="scanner-class2" known')

    cy.task('giveBlueprint', { email, module: 'gun-class2' })
    command('factory')
    cy.contains('- blueprint id="')
    idsOf(email, 'blueprint').then(([id]) => command(`learn ${id}`))
    cy.contains('learned the blueprint of gun-class2')
    command('recipes')
    cy.contains('module="gun-class2" known')
  })
})
