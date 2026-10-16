import { newEmail } from '../support/commands'

const REASON = 'checked by the end-to-end suite'
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// The menu of the console, where a role sees only the pages it may use
const menu = () => cy.get('.ant-layout-sider')

// Fills the reason of an action and confirms it in the dialog the console opens
function confirmWithReason(reason = REASON) {
  cy.get('.ant-modal textarea').type(reason)
  cy.get('.ant-modal').contains('button', 'Confirm').click()
  cy.get('.ant-modal').should('not.exist')
}

describe('access to the console', () => {
  it('sends a player who is not an admin back to the game', () => {
    cy.createPlayer().then(({ token }) => {
      cy.visitSignedIn('/admin', token)
      cy.location('pathname').should('eq', '/game')
    })
  })

  it('shows each role the pages it may use, and no others', () => {
    cy.createAdmin('analyst').then(({ token }) => {
      cy.visitSignedIn('/admin', token)
      menu().within(() => {
        cy.contains('a', 'Dashboard')
        cy.contains('a', 'Economy and balance')
        cy.contains('a', 'Analytics')
        cy.contains('a', 'Documentation')
        cy.contains('a', 'Players').should('not.exist')
        cy.contains('a', 'Logs and audit').should('not.exist')
      })
    })
    cy.createAdmin('moderator').then(({ token }) => {
      cy.visitSignedIn('/admin', token)
      menu().within(() => {
        cy.contains('a', 'Players')
        cy.contains('a', 'Inspector')
        cy.contains('a', 'Security')
        cy.contains('a', 'Economy and balance').should('not.exist')
      })
    })
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin', token)
      menu().within(() => {
        cy.contains('a', 'Logs and audit')
        cy.contains('a', 'Economy and balance')
        cy.contains('a', 'Dev tools').should('not.exist')
      })
    })
    cy.createAdmin('owner').then(({ token }) => {
      cy.visitSignedIn('/admin', token)
      menu().contains('a', 'Dev tools')
    })
  })

  it('refuses a page of the console to a role without its permission', () => {
    cy.createAdmin('analyst').then(({ token }) => {
      cy.apiRequest({ path: '/api/v1/admin/players', headers: bearer(token), failOnStatusCode: false })
        .its('status')
        .should('eq', 403)
    })
  })
})

describe('the second factor', () => {
  it('is set up in the console: the key, the first code, then the recovery codes', () => {
    const email = newEmail('admin')
    cy.createPlayer(email).then(({ token }) => {
      cy.task('setUserStatus', { email, status: 'admin' })
      cy.visitSignedIn('/admin', token)

      cy.contains('Set up two-factor authentication')
      cy.contains('button', 'Set up').click()
      cy.get('.ant-alert .ant-typography')
        .invoke('text')
        .then((secret) => cy.task<string>('totpCode', { secret: secret.trim() }))
        .then((code) => cy.get('input[placeholder="6-digit code"]').type(code))
      cy.contains('button', 'Confirm').click()

      cy.contains('Save your recovery codes')
      cy.get('[data-testid=recovery-codes] div').should('have.length.greaterThan', 3)
      cy.contains('button', 'I have saved them').click()
      menu().contains('a', 'Dashboard')
    })
  })

  it('is asked for again in a new session, and a recovery code serves', () => {
    cy.createAdmin('moderator').then(({ email, recoveryCodes }) => {
      cy.loginViaForm(email)
      cy.location('pathname').should('eq', '/game')
      cy.visit('/admin')

      cy.contains('Verify your sign-in')
      cy.get('input[placeholder="Code or recovery code"]').type(recoveryCodes[0])
      cy.contains('button', 'Verify').click()
      menu().contains('a', 'Dashboard')
    })
  })
})

describe('the dashboard', () => {
  it('shows the health of the game and the alerts', () => {
    cy.createAdmin('owner').then(({ token }) => {
      cy.visitSignedIn('/admin', token)

      cy.contains('Alerts')
      cy.contains('Engine')
      cy.contains('Live')
    })
  })
})

describe('moderating a player', () => {
  it('bans a player from the profile, which cuts them off at once, and audits it with the reason', () => {
    cy.createPlayer().then((player) => {
      cy.createAdmin('moderator').then(({ token: adminToken }) => {
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) }).then((me) => {
          const playerId = (me.body as { _id: string })._id

          cy.visitSignedIn(`/admin/players/${playerId}`, adminToken)
          cy.contains('button', 'Ban').click()
          confirmWithReason('spamming the chat')
          cy.contains('Banned until')

          cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token), failOnStatusCode: false })
            .its('status')
            .should('eq', 401)
          cy.createAdmin('owner').then(({ token: ownerToken }) => {
            cy.apiRequest({
              path: `/api/v1/admin/audit?action=players.ban&targetId=${playerId}`,
              headers: bearer(ownerToken)
            }).then((trail) => {
              const [entry] = (trail.body as { result: Array<{ reason: string; actorRole: string }> }).result
              expect(entry).to.include({ reason: 'spamming the chat', actorRole: 'moderator' })
            })
          })
        })
      })
    })
  })

  it('finds a player by email', () => {
    const email = newEmail('findable')
    cy.createPlayer(email).then(() => {
      cy.createAdmin('admin').then(({ token }) => {
        cy.visitSignedIn('/admin/players', token)
        cy.get('input[placeholder="Search by name, email or id"]').type(email)
        cy.contains('td', email)
      })
    })
  })
})

describe('the inspector', () => {
  it('shows a base to a moderator, and reading a file of it is audited without its content', () => {
    cy.createPlayer().then((player) => {
      cy.deployBaseViaApi(player.token).then((base) => {
        cy.writeScriptFile({ token: player.token, botId: base.id, path: 'secret.js', content: 'const private = 1' })
        cy.createAdmin('admin').then(({ token }) => {
          cy.visitSignedIn(`/admin/inspector/${base.id}`, token)
          cy.contains('Drives and files')

          cy.apiRequest({ path: `/api/v1/bots/${base.id}/modules`, headers: bearer(player.token) }).then((modules) => {
            const drive = (modules.body as Array<{ _id: string; type: string }>).find(
              (module) => module.type === 'drive'
            )!
            cy.apiRequest({
              path: `/api/v1/admin/inspector/bots/${base.id}/drives/${drive._id}/file?path=secret.js`,
              headers: bearer(token)
            })
              .its('body.content')
              .should('eq', 'const private = 1')
          })
          cy.apiRequest({ path: '/api/v1/admin/audit?action=inspector.read-file', headers: bearer(token) }).then(
            (trail) => {
              const [entry] = (trail.body as { result: Array<{ targetType: string; before: unknown; after: unknown }> })
                .result
              expect(JSON.stringify(entry)).not.to.contain('const private')
            }
          )
          cy.visitSignedIn('/admin/logs', token)
          cy.contains('inspector.read-file')
          // The application log: every line carries the trace it was written in, and the filters of the log store are there
          cy.contains('[role="tab"]', 'Application log').click()
          cy.get('input[placeholder="Trace id"]').should('be.visible')
          cy.get('input[placeholder="Player id"]').should('be.visible')
          cy.contains('All nodes')
          cy.apiRequest({ path: '/api/v1/admin/logs?results=5', headers: bearer(token) }).then((logs) => {
            const page = logs.body as { store: string; lines: Array<{ traceId: string; node: string }> }
            expect(page.store).to.eq('memory')
            expect(page.lines[0].traceId).to.match(/^[0-9a-f]{32}$/)
            expect(page.lines[0].node).to.be.a('string')
            // Following a request: its trace opens with the lines written in it, and the read is audited
            cy.get('input[placeholder="Trace id, or the request id of an older line"]').type(page.lines[0].traceId)
            cy.get('.ant-input-search-button').click()
            cy.get('.ant-drawer').within(() => {
              cy.contains('Trace id')
              cy.contains(page.lines[0].traceId)
            })
            cy.apiRequest({ path: '/api/v1/admin/audit?action=logs.read-trace', headers: bearer(token) })
              .its('body.result.0.targetId')
              .should('eq', page.lines[0].traceId)
          })
        })
      })
    })
  })
})

describe('supervision and maintenance', () => {
  let ownerToken: string

  beforeEach(() => {
    cy.createAdmin('owner').then(({ token }) => {
      ownerToken = token
    })
  })

  // Whatever a test did, the world runs again for the specs that follow
  afterEach(() => {
    cy.apiRequest({
      method: 'POST',
      path: '/api/v1/admin/supervision/resume',
      headers: bearer(ownerToken),
      body: { reason: 'the end of the test' },
      failOnStatusCode: false
    })
  })

  it('pauses the world after the word is typed, tells the players, writes the trail, and resumes', () => {
    cy.visitSignedIn('/admin/supervision', ownerToken)
    cy.contains('button', 'Pause the world').click()
    cy.get('.ant-modal input').first().type('PAUSE')
    confirmWithReason('maintenance window')
    cy.contains('Paused')

    cy.createPlayer().then((player) => {
      cy.visitSignedIn('/game', player.token)
      cy.contains('The world is paused for maintenance.')
    })
    cy.apiRequest({ path: '/api/v1/admin/audit?action=supervision.pause-world', headers: bearer(ownerToken) }).then(
      (trail) => {
        const [entry] = (trail.body as { result: Array<{ reason: string }> }).result
        expect(entry.reason).to.eq('maintenance window')
      }
    )

    cy.visitSignedIn('/admin/supervision', ownerToken)
    cy.contains('button', 'Resume the world').click()
    confirmWithReason('done')
    cy.contains('Running')
  })

  it('shows players a banner for a coming maintenance, and takes it down', () => {
    cy.visitSignedIn('/admin/operations', ownerToken)
    cy.get('input[id$="message"], input').filter('[maxlength="300"]').first().type('Down for an hour on Friday')
    cy.get('input[type="datetime-local"]').first().type('2030-01-01T10:00')
    cy.contains('button', 'Show the banner').click()
    confirmWithReason('planned update')

    cy.createPlayer().then((player) => {
      cy.visitSignedIn('/game', player.token)
      cy.contains('Down for an hour on Friday')
    })

    cy.visitSignedIn('/admin/operations', ownerToken)
    cy.contains('button', 'Remove').click()
    confirmWithReason('done')
    cy.apiRequest({ path: '/api/v1/maintenance' }).its('body.banner').should('eq', null)
  })
})

describe('the economy and the balance', () => {
  it('saves a version of the balance, saves another, and rolls back to the first', () => {
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin/economy', token)
      cy.contains('[role=tab]', 'Balance').click()

      const edit = (document: string) => {
        cy.get('textarea[aria-label="Balance document"]').clear()
        cy.get('textarea[aria-label="Balance document"]').invoke('val', document).trigger('input')
        cy.get('textarea[aria-label="Balance document"]').type(' ').type('{backspace}')
      }

      edit('{"crafting":{"repairThreshold":0.31}}')
      cy.contains('button', 'Check and compare').click()
      cy.contains('crafting.repairThreshold')
      cy.contains('button', 'Save as a new version').click()
      confirmWithReason('a first change')
      cy.contains('td', 'a first change')

      edit('{}')
      cy.contains('button', 'Save as a new version').click()
      confirmWithReason('back to the defaults')
      cy.contains('td', 'back to the defaults')

      cy.contains('td', 'a first change').parent('tr').contains('button', 'Roll back').click()
      confirmWithReason('the first one was better')
      cy.contains('Rollback to version')
      cy.apiRequest({ path: '/api/v1/admin/balance', headers: bearer(token) }).then((state) => {
        const body = state.body as { documentJson: string; versions: unknown[] }
        expect(JSON.parse(body.documentJson)).to.deep.eq({ crafting: { repairThreshold: 0.31 } })
        expect(body.versions).to.have.length(3)
      })

      // Leaves the defaults for the runs that follow
      edit('{}')
      cy.contains('button', 'Save as a new version').click()
      confirmWithReason('restored for the next run')
    })
  })
})

describe('announcements', () => {
  it('reach a player as a notification', () => {
    cy.createPlayer().then((player) => {
      cy.createAdmin('admin').then(({ token }) => {
        cy.visitSignedIn('/admin/operations', token)
        cy.get('textarea[id$="text"], textarea')
          .filter('[maxlength="500"]')
          .first()
          .type('Maintenance on Friday at noon')
        cy.contains('button', 'Send to all players').click()
        confirmWithReason('planned update')
        cy.contains('players were told')
      })
      cy.apiRequest({ path: '/api/v1/notifications', headers: bearer(player.token) }).then((list) => {
        const items = (list.body as { items: Array<{ kind: string; params: { text: string } }> }).items
        expect(items.find((item) => item.kind === 'announcement')?.params.text).to.eq('Maintenance on Friday at noon')
      })
    })
  })
})

describe('the documentation of the console', () => {
  it('is open to every admin role and searchable', () => {
    cy.createAdmin('analyst').then(({ token }) => {
      cy.visitSignedIn('/admin/docs', token)
      cy.contains('h1', 'Admin console')
      cy.get('input[aria-label="Search the admin documentation"]').type('kill-switch')
      cy.contains('page').should('exist')
      cy.contains('a', 'Supervision').click()
      cy.contains('h1', 'Supervision')
    })
  })

  it('opens the section of a page from its question mark', () => {
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin/players', token)
      cy.get('a[aria-label="Help for this page"]').click()
      cy.location('pathname').should('eq', '/admin/docs/players')
      cy.contains('h1', 'Players')
    })
  })

  it('writes the permissions from the code', () => {
    cy.createAdmin('moderator').then(({ token }) => {
      cy.visitSignedIn('/admin/docs/permissions', token)
      cy.contains('td', 'players.ban')
    })
  })
})
