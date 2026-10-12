import { eventually, newEmail } from '../support/commands'

// A bot that can run a script (processor, memory, battery, wireless adapter) with what a task needs on top
const SCRIPTED = ['processor-class1', 'memory-class1', 'wireless-adapter-class1', 'battery-class1']

function command(text: string) {
  cy.get('input.terminal-input').first().type(text, { parseSpecialCharSequences: false }).type('{enter}')
}

describe('the core of the game: scripts that mine, fight and run out of energy', () => {
  let email: string
  let token: string
  let baseId: string
  let base: { x: number; y: number }

  beforeEach(() => {
    email = newEmail()
    cy.createPlayer(email).then((player) => {
      token = player.token
      cy.deployBaseViaApi(token).then((deployed) => {
        baseId = deployed.id
        base = deployed.at
      })
      cy.visit('/game', { onBeforeLoad: (win) => win.localStorage.setItem('token', token) })
    })
    cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
  })

  // A bot with the modules, put on a cell of its own where it can work in peace, with the script on its drive
  function bot(modules: string[], at: { dx: number; dy: number }, script?: string) {
    return cy.assembleWorker({ email, token, baseId, modules: [...SCRIPTED, ...modules] }).then((botId) => {
      cy.task('placeBotAt', { botId, x: base.x + at.dx, y: base.y + at.dy })
      if (script) {
        cy.writeScriptFile({ token, botId, path: 'job.js', content: script })
      }

      return cy.wrap(botId)
    })
  }

  // The engine reads the world again after an action of the base: what a task wrote into the database is seen
  function letTheEngineLook() {
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/bots/${baseId}/scan`,
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false
    })
  }

  // Opens the terminal of the bot and runs its script there
  function runJob(botId: string) {
    command(`connect ${botId}`)
    const title = `Terminal ${botId.slice(0, 8)}`
    cy.contains('.game-window-title', title)

    return cy.contains('.game-window', title).within(() => {
      cy.get('input.terminal-input').type('cd memory-class1{enter}')
      cy.get('input.terminal-input').type('run job.js{enter}')
    })
  }

  it('mines a deposit with a script: the ore arrives in the storage of the bot', () => {
    bot(
      ['drill-class1', 'storage-class1'],
      { dx: 8, dy: 8 },
      'export async function main(bot) { for (let i = 0; i < 3; i++) { const r = await bot.dig(); bot.log(r.ok ? "mined " + r.data.amount + " " + r.data.resource : "failed " + r.code) } }'
    ).then((botId) => {
      cy.task('placeResourceAhead', { botId, resource: 'iron', amount: 100 })
      letTheEngineLook()

      runJob(botId)

      cy.contains('mined 5 iron')
      eventually(
        () => cy.task<Record<string, number>>('stockOf', { botId }),
        (held) => held.iron === 15
      ).should('deep.equal', { oil: 50, iron: 15 })
    })
  })

  it('empties a deposit, and the next miner is told there is nothing left', () => {
    const dig =
      'export async function main(bot) { for (let i = 0; i < 3; i++) { const r = await bot.dig(); bot.log(r.ok ? "mined " + r.data.amount : "failed " + r.code) } }'

    bot(['drill-class1', 'storage-class1'], { dx: 8, dy: 8 }, dig).then((first) => {
      cy.task<{ x: number; y: number }>('placeResourceAhead', { botId: first, resource: 'iron', amount: 7 }).then(
        (deposit) => {
          // A second bot stands beside the deposit and mines it by its coordinates
          bot(['drill-class1', 'storage-class1'], { dx: 9, dy: 8 }).then((second) => {
            cy.writeScriptFile({
              token,
              botId: second,
              path: 'job.js',
              content:
                'export async function main(bot, x, y) { const r = await bot.mine(x, y); bot.log(r.ok ? "mined " + r.data.amount : "failed " + r.code) }'
            })
            letTheEngineLook()

            runJob(first)
            cy.contains('mined 5')
            cy.contains('mined 2')
            cy.contains('failed EMPTY')
            cy.contains('.game-window', `Terminal ${first.slice(0, 8)}`)
              .find('button[aria-label="Close window"]')
              .click()
            eventually(
              () => cy.task<{ type: string | null } | null>('cellAt', deposit),
              (cell) => !cell || cell.type === null
            ).should('satisfy', (cell: { type: string | null } | null) => !cell || cell.type === null)

            command(`connect ${second}`)
            cy.contains('.game-window', `Terminal ${second.slice(0, 8)}`).within(() => {
              cy.get('input.terminal-input').type('cd memory-class1{enter}')
              cy.get('input.terminal-input').type(`run job.js ${deposit.x} ${deposit.y}{enter}`)
              cy.contains('failed EMPTY')
            })
          })
        }
      )
    })
  })

  it('stops a bot that has no energy for what it asks: the answer is NO_ENERGY, not an exception', () => {
    bot(
      ['drill-class1', 'storage-class1'],
      { dx: 8, dy: 8 },
      'export async function main(bot) { for (let i = 0; i < 4; i++) { const r = await bot.dig(); bot.log(r.ok ? "mined" : "failed " + r.code) } }'
    ).then((botId) => {
      cy.task('placeResourceAhead', { botId, resource: 'iron', amount: 100 })
      // Energy for one dig, not for two
      cy.task('setModuleProps', { botId, type: 'battery', props: { value: 4 } })
      letTheEngineLook()

      runJob(botId)

      cy.contains('failed NO_ENERGY')
      eventually(
        () => cy.task<Record<string, number>>('stockOf', { botId }),
        (held) => held.iron === 5
      ).should('deep.equal', { oil: 50, iron: 5 })
    })
  })

  it('shoots a bot of its own until a module breaks, with the cooldown of the gun in between', () => {
    bot(
      ['gun-class1'],
      { dx: 8, dy: 8 },
      'export async function main(bot, x, y) { const first = await bot.shoot(x, y); const second = await bot.shoot(x, y); bot.log("first " + (first.ok ? "ok" : first.code)); bot.log("second " + (second.ok ? "ok" : second.code)); for (let i = 0; i < 3; i++) { await bot.sleep(2100); await bot.shoot(x, y) } }'
    ).then((shooter) => {
      bot([], { dx: 8, dy: 6 }).then((target) => {
        cy.task('damageAllModules', { botId: target, condition: 1 })
        // A sure hit: the gun never misses
        cy.task('setModuleProps', { botId: shooter, type: 'weapon', props: { accuracy: 1 } })
        letTheEngineLook()

        command(`connect ${shooter}`)
        cy.contains('.game-window', `Terminal ${shooter.slice(0, 8)}`).within(() => {
          cy.get('input.terminal-input').type('cd memory-class1{enter}')
          cy.get('input.terminal-input').type(`run job.js ${base.x + 8} ${base.y + 6}{enter}`)
          cy.contains('first ok')
          cy.contains('second COOLDOWN')
        })

        eventually(
          () => cy.task<{ condition: number }[]>('moduleStates', { botId: target }),
          (modules) => modules.some((module) => module.condition === 0),
          60
        ).should('satisfy', (modules: { condition: number }[]) => modules.some((module) => module.condition === 0))
      })
    })
  })

  it('keeps a scanner either in live mode or in one-time mode: scan is refused while it is live', () => {
    bot(
      ['scanner-class1'],
      { dx: 8, dy: 8 },
      `export async function main(bot) {
        const scanner = bot.modules.find((m) => m.type === "scanner")
        const view = await bot.view()
        bot.log("view before: " + (view.ok ? "ok" : view.code))
        const on = await bot.enable(scanner.id)
        const busy = await bot.scan()
        bot.log("enabled " + on.ok + ", scan while live: " + (busy.ok ? "ok" : busy.code))
        const off = await bot.disable(scanner.id)
        const again = await bot.scan()
        bot.log("disabled " + off.ok + ", scan after: " + (again.ok ? "ok" : again.code))
      }`
    ).then((botId) => {
      runJob(botId)

      cy.contains('view before: NOT_LIVE')
      cy.contains('enabled true, scan while live: BUSY')
      cy.contains('disabled true, scan after: ok')
    })
  })

  it('handles a scan that went stale: the deposit is gone when the script digs, so it scans again', () => {
    bot(
      ['drill-class1', 'storage-class1', 'scanner-class1'],
      { dx: 8, dy: 8 },
      `export async function main(bot) {
        const before = await bot.scan()
        bot.log("scanned " + before.data.filter((c) => c.type === "resource").length)
        await bot.sleep(8000)
        const dug = await bot.dig()
        bot.log(dug.ok ? "dug" : "stale " + dug.code)
        if (!dug.ok) {
          await bot.sleep(500)
          const after = await bot.scan()
          bot.log("rescanned " + (after.ok ? after.data.filter((c) => c.type === "resource").length : after.code))
        }
      }`
    ).then((botId) => {
      cy.task<{ x: number; y: number }>('placeResourceAhead', { botId, resource: 'gold', amount: 10 }).then(
        (deposit) => {
          letTheEngineLook()

          runJob(botId)
          // The scan shows the deposit and whatever else the world made there
          cy.contains(/scanned \d+/)
            .invoke('text')
            .then((text) => {
              const before = Number(/scanned (\d+)/.exec(text)![1])

              // Somebody else mined it meanwhile
              cy.task('removeCell', deposit)
              letTheEngineLook()

              cy.contains('stale EMPTY', { timeout: 15000 })
              cy.contains(`rescanned ${before - 1}`)
            })
        }
      )
    })
  })

  it('keeps an area live with a scanner: a bot of another player that comes close is seen, and becomes an ageing snapshot when the scanner is off', () => {
    const headers = { Authorization: `Bearer ${token}` }
    const mapAround = (at: { x: number; y: number }) =>
      cy
        .apiRequest({
          path: `/api/v1/map?minX=${at.x - 6}&minY=${at.y - 6}&maxX=${at.x + 6}&maxY=${at.y + 6}`,
          headers
        })
        .its('body') as unknown as Cypress.Chainable<{
        cells: Array<{ x: number; y: number; contentId: string | null; isOwn?: boolean; seenAt: number }>
        liveAreas: unknown[]
      }>
    const watch = { x: base.x + 8, y: base.y + 8 }

    bot(['scanner-class1'], { dx: 8, dy: 8 }).then((watcher) => {
      cy.apiRequest({ path: `/api/v1/bots/${watcher}/modules`, headers }).then((modules) => {
        const scanner = (modules.body as Array<{ _id: string; type: string }>).find((m) => m.type === 'scanner')!
        const manual = (fn: string) =>
          cy.apiRequest({
            method: 'POST',
            path: `/api/v1/bots/${watcher}/actions`,
            headers,
            body: { fn, args: [scanner._id] }
          })

        // The other player's bot is next to the watcher, but nobody has seen it
        const otherEmail = newEmail()
        cy.createPlayer(otherEmail).then(({ token: otherToken }) => {
          cy.deployBaseViaApi(otherToken).then(({ id: otherBase }) => {
            cy.assembleWorker({ email: otherEmail, token: otherToken, baseId: otherBase, modules: SCRIPTED }).then(
              (stranger) => {
                cy.task('placeBotAt', { botId: stranger, x: watch.x + 1, y: watch.y })
                letTheEngineLook()
                mapAround(watch).then(({ cells, liveAreas }) => {
                  expect(cells.find((cell) => cell.contentId === stranger)).to.equal(undefined)
                  expect(liveAreas).to.have.length(0)
                })

                manual('enable').its('body.ok').should('equal', true)
                cy.reload()
                cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
                cy.get('button[aria-label="Close window"]').click()

                // The live area is announced and the stranger is in it, as the watcher sees it now
                eventually(
                  () => mapAround(watch),
                  ({ cells }) => cells.some((cell) => cell.contentId === stranger)
                ).then(({ cells, liveAreas }) => {
                  expect(liveAreas).to.have.length(1)
                  expect(cells.find((cell) => cell.contentId === stranger)).to.include({ isOwn: false })
                })
                cy.get('[data-testid=map] canvas').then(($canvas) => {
                  cy.wrap($canvas).click(
                    Math.floor($canvas[0].clientWidth / 2) + 9 * 32,
                    Math.floor($canvas[0].clientHeight / 2) + 8 * 32
                  )
                })
                cy.contains('.map-inspector', "Another player's bot")
                cy.contains('.map-inspector', 'Live now')

                // Switched off, the area is a snapshot that ages
                manual('disable').its('body.ok').should('equal', true)
                eventually(
                  () => mapAround(watch),
                  ({ liveAreas }) => liveAreas.length === 0
                ).then(({ cells, liveAreas }) => {
                  expect(liveAreas).to.have.length(0)
                  expect(cells.some((cell) => cell.contentId === stranger)).to.equal(true)
                })
                cy.contains('.map-inspector', /Seen \d+ s ago/)
              }
            )
          })
        })
      })
    })
  })

  it('learns a blueprint found in the world: the recipe is known afterwards', () => {
    cy.task('giveBlueprint', { email, module: 'scanner-class2' })
    cy.contains('.game-toolbar button', 'Factory').click()

    cy.contains('.game-window', 'Factory').within(() => {
      cy.contains('.factory-recipe', 'Scanner, class 2').contains('button', 'Craft').should('not.exist')
      cy.contains('li', 'Scanner, class 2').contains('button', 'Learn').click()
      cy.contains('Scanner, class 2 learned')
      cy.contains('.factory-recipe', 'Scanner, class 2').contains('button', 'Craft')
    })
  })

  it('restores a corpse base: a repair bot of the player mends its wireless adapter', () => {
    // The adapter of the first base breaks, and the base is lost to the player, who deploys a second one
    cy.task<string>('damageModule', { botId: baseId, type: 'wirelessAdapter', condition: 0 }).then((adapterId) => {
      cy.deployBaseViaApi(token).then(({ id: newBaseId }) => {
        cy.assembleWorker({
          email,
          token,
          baseId: newBaseId,
          modules: [...SCRIPTED, 'repair-class1', 'storage-class1'],
          label: 'Mender'
        }).then((mender) => {
          cy.task('setModuleProps', {
            botId: mender,
            type: 'storage',
            props: {
              capacity: 500,
              items: [
                { resource: 'crystal', amount: 100 },
                { resource: 'gold', amount: 100 }
              ]
            }
          })
          cy.writeScriptFile({
            token,
            botId: mender,
            path: 'job.js',
            content:
              'export async function main(bot, corpse, adapter) { await bot.sleep(3000); const r = await bot.repair(corpse, adapter); bot.log(r.ok ? "repaired" : "failed " + r.code) }'
          })

          // The game opens on the new base, and the script is started while the bot is in reach; then the bot is put next to the
          // corpse, where it works out of reach of its base
          cy.reload()
          cy.contains('# Welcome to BotOS Alpha 0.1.0 #')
          command(`connect ${mender}`)
          cy.contains('.game-window', `Terminal ${mender.slice(0, 8)}`).within(() => {
            cy.get('input.terminal-input').type('cd memory-class1{enter}')
            cy.get('input.terminal-input').type(`run job.js ${baseId} ${adapterId}{enter}`)
            cy.contains('started')
          })
          cy.task('placeBotAt', { botId: mender, x: base.x + 1, y: base.y })
          cy.apiRequest({
            method: 'POST',
            path: `/api/v1/bots/${newBaseId}/scan`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false
          })

          cy.contains('repaired')
          eventually(
            () => cy.task<{ type: string; condition: number }[]>('moduleStates', { botId: baseId }),
            (modules) => modules.find((module) => module.type === 'wirelessAdapter')!.condition > 0
          ).then((modules) =>
            expect(modules.find((module) => module.type === 'wirelessAdapter')!.condition).to.be.greaterThan(0)
          )
          cy.apiRequest({ path: '/api/v1/bots?type=base', headers: { Authorization: `Bearer ${token}` } })
            .its('body')
            .should('have.length', 2)
        })
      })
    })
  })
})
