import { eventually, newEmail } from '../support/commands'

// A bot that can run a script and drive
const DRIVER = [
  'processor-class1',
  'memory-class1',
  'wireless-adapter-class1',
  'battery-class1',
  'engine-class1',
  'wheels-class1'
]
// A bot that can look and run a script
const SCOUT = ['processor-class1', 'memory-class1', 'wireless-adapter-class1', 'battery-class1', 'scanner-class1']
const GUNNER = ['processor-class1', 'memory-class1', 'wireless-adapter-class1', 'battery-class1', 'gun-class1']

interface Cell {
  x: number
  y: number
}

interface Player {
  email: string
  token: string
  baseId: string
  base: Cell
}

const headers = (player: Player) => ({ Authorization: `Bearer ${player.token}` })

// Two players who start next to each other (the same spawn seed), each with a base, and a second, API-driven client: the specs act
// as the players through the public API only, like any third-party client. Everything happens within the radio range of both bases, so
// that neither player loses sight of their bots.
describe('two players in one world', () => {
  let alice: Player
  let bob: Player
  // The place the specs work at, a few cells from the middle between the two bases
  let spot: Cell

  function player(name: string, spawnSeed: string): Cypress.Chainable<Player> {
    const email = newEmail(name)

    return cy
      .createPlayer(email)
      .then(({ token }) =>
        cy.deployBaseViaApi(token, { spawnSeed }).then(({ id, at }) => ({ email, token, baseId: id, base: at }))
      )
  }

  beforeEach(() => {
    const seed = `E2E-${Date.now().toString(36)}-${Cypress._.random(100, 999)}`.toUpperCase()
    player('alice', seed).then((created) => (alice = created))
    player('bob', seed).then((created) => {
      bob = created
      // Between the two bases, so that both are in radio range of whatever happens there
      spot = {
        x: Math.round((alice.base.x + bob.base.x) / 2) + 3,
        y: Math.round((alice.base.y + bob.base.y) / 2) + 3
      }
    })
  })

  const lookFrom = (who: Player) =>
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${who.baseId}/scan`,
      headers: headers(who),
      failOnStatusCode: false
    })

  const script = (who: Player, botId: string, content: string) =>
    cy.writeScriptFile({ token: who.token, botId, path: 'job.js', content })

  // What a player knows of a rectangle of the map
  const mapOf = (who: Player, around: Cell, radius = 20) =>
    cy
      .apiRequest({
        path: `/api/v1/map?minX=${around.x - radius}&minY=${around.y - radius}&maxX=${around.x + radius}&maxY=${around.y + radius}`,
        headers: headers(who)
      })
      .its('body.cells') as unknown as Cypress.Chainable<
      Array<{ x: number; y: number; type: string | null; contentId: string | null; isOwn?: boolean }>
    >

  // A bot of the player, next to the place; the engine learns of it with the scan from the base
  function bot(who: Player, modules: string[], at: Cell, label: string) {
    return cy.assembleWorker({ ...who, modules, label }).then((botId) => {
      cy.task('placeBotAt', { botId, x: at.x, y: at.y })
      lookFrom(who)

      return cy.wrap(botId)
    })
  }

  // What a script of the bot has written so far
  const said = (who: Player, botId: string, line: RegExp) =>
    cy.historyHas({ token: who.token, botId, line }).then((lines) => lines.find((text) => line.test(text)) ?? '')

  it('lets one of two bots that move onto the same cell win it, and tells the other BLOCKED', () => {
    // Alice's bot faces north and stands just south of the contested cell; Bob's stands just east of it and turns west.
    // The cell is empty on the map, so that no deposit the world generated there makes both moves fail.
    cy.task('emptyCell', spot)
    bot(alice, DRIVER, { x: spot.x, y: spot.y + 1 }, 'North').then((aliceBot) => {
      bot(bob, DRIVER, { x: spot.x + 1, y: spot.y }, 'East').then((bobBot) => {
        script(
          alice,
          aliceBot,
          'export async function main(bot) { const r = await bot.move(1); bot.log("move " + (r.ok ? "ok" : r.code)) }'
        )
        script(
          bob,
          bobBot,
          'export async function main(bot) { await bot.turn("left"); const r = await bot.move(1); bot.log("move " + (r.ok ? "ok" : r.code)) }'
        )

        cy.runScript({ token: alice.token, botId: aliceBot })
        cy.runScript({ token: bob.token, botId: bobBot })

        said(alice, aliceBot, /move (ok|BLOCKED)/).then((aliceSaid) => {
          said(bob, bobBot, /move (ok|BLOCKED)/).then((bobSaid) => {
            // Whoever got there first has the cell; the other was told it is taken
            expect([aliceSaid, bobSaid].map((line) => line.replace(/^.*move /, '')).sort()).to.deep.equal([
              'BLOCKED',
              'ok'
            ])
          })
        })
      })
    })
  })

  it('keeps the fog of war private: what one player has seen is unknown to the other until the other looks', () => {
    // Alice has looked around her base; Bob has not been there
    lookFrom(alice)
    mapOf(alice, alice.base, 5).should('have.length.greaterThan', 0)
    mapOf(bob, alice.base, 1).then((cells) => {
      expect(cells.filter((cell) => cell.contentId === alice.baseId)).to.have.length(0)
    })

    // Bob sends a scout next to her base: he sees the base now, as someone else's
    bot(bob, SCOUT, { x: alice.base.x + 1, y: alice.base.y }, 'Scout').then((scout) => {
      script(
        bob,
        scout,
        'export async function main(bot) { const r = await bot.scan(); bot.log("scan " + (r.ok ? "ok" : r.code)) }'
      )
      cy.runScript({ token: bob.token, botId: scout })
      said(bob, scout, /scan (ok|[A-Z_]+)/).should('contain', 'scan ok')

      mapOf(bob, alice.base, 3).then((cells) => {
        const seen = cells.find((cell) => cell.contentId === alice.baseId)

        expect(seen?.type).to.equal('base')
        expect(seen?.isOwn).to.equal(false)
      })
    })
  })

  it('shows an attack to the defender: a notification that his bot is under attack', () => {
    bot(alice, GUNNER, spot, 'Gunner').then((gunner) => {
      bot(bob, DRIVER, { x: spot.x, y: spot.y - 2 }, 'Target').then((target) => {
        // A sure hit, and several shots: the distance still takes some of the accuracy
        cy.task('setModuleProps', { botId: gunner, type: 'weapon', props: { accuracy: 1 } })
        // The engine reads the module again after an action of the base
        lookFrom(alice)
        script(
          alice,
          gunner,
          `export async function main(bot) { const r = await bot.shoot(${spot.x}, ${spot.y - 2}); bot.log("shot " + (r.ok ? "ok" : r.code)); for (let i = 0; i < 5; i++) { await bot.sleep(2100); await bot.shoot(${spot.x}, ${spot.y - 2}) } }`
        )

        cy.runScript({ token: alice.token, botId: gunner })

        said(alice, gunner, /shot (ok|[A-Z_]+)/).should('contain', 'shot ok')
        // Bob did nothing and is told: the notification names his bot
        eventually(
          () =>
            cy
              .apiRequest({ path: '/api/v1/notifications', headers: headers(bob) })
              .its('body.items') as unknown as Cypress.Chainable<Array<{ kind: string; botId: string | null }>>,
          (items) => items.some((item) => item.kind === 'underAttack'),
          120
        ).then((items) => {
          expect(items.find((item) => item.kind === 'underAttack')?.botId).to.equal(target)
        })
        // and in the game he is looking at
        cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', bob.token) })
        cy.contains('.game-toolbar button', 'Notifications').click()
        cy.contains('.game-window-title', 'Notifications').closest('.game-window').contains('is under attack')
      })
    })
  })

  it('shows a lost base as a corpse base to others, and lets a player adopt one of its stale bots', () => {
    bot(alice, DRIVER, { x: alice.base.x + 1, y: alice.base.y + 1 }, 'Orphan').then((orphan) => {
      // Alice sets a password on the bot she is going to lose with her base
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', alice.token) })
      cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
      cy.get('input.terminal-input').first().type(`connect ${orphan}{enter}`)
      cy.contains('.game-window', `Terminal ${orphan.slice(0, 8)}`).within(() => {
        cy.get('input.terminal-input').type('passwd orphan1{enter}')
        cy.contains('password changed')
      })

      // Bob's scout stands next to her base and looks at it: a living base of someone else
      bot(bob, SCOUT, { x: alice.base.x + 1, y: alice.base.y }, 'Scout').then((scout) => {
        const look = () => {
          cy.runScript({ token: bob.token, botId: scout })
        }
        script(bob, scout, 'export async function main(bot) { await bot.scan(); bot.log("looked") }')
        look()
        said(bob, scout, /looked/)
        mapOf(bob, alice.base, 3).then((cells) => {
          expect(cells.find((cell) => cell.contentId === alice.baseId)?.type).to.equal('base')
        })

        // Alice loses the adapter that gives her control of her base: it becomes a corpse, and her bot is stale
        cy.task('breakBaseAdapter', { email: alice.email })
        // Alice deploys a new base, which is when the game marks the lost one on the map
        cy.deployBaseViaApi(alice.token)
        eventually(
          () => {
            look()
            return mapOf(bob, alice.base, 3)
          },
          (cells) => cells.some((cell) => cell.contentId === alice.baseId && cell.type === 'corpse_base'),
          30
        ).then((cells) => {
          // The corpse stays on the map for everyone who has seen it, and so does the bot left without an owner
          expect(cells.find((cell) => cell.contentId === alice.baseId)?.type).to.equal('corpse_base')
          expect(cells.find((cell) => cell.contentId === orphan)?.isOwn).to.equal(false)
        })
      })

      // Bob reaches the stale bot with its password and takes it into his base
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', bob.token) })
      cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
      cy.get('input.terminal-input').first().type(`connect ${orphan} orphan1{enter}`)
      cy.contains('.game-window', `Terminal ${orphan.slice(0, 8)}`).within(() => {
        cy.get('input.terminal-input').type('adopt{enter}')
        cy.contains('the bot is yours now')
      })
      cy.task<Array<{ id: string }>>('workersOf', { email: bob.email }).should('have.length.greaterThan', 0)
    })
  })
})
