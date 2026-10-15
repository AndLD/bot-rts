const REASON = 'following support ticket 4711'
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// The profile page of a player in the console, with the click on "View as player" caught instead of opening a second tab
// (Cypress drives one tab): the handoff the new tab would take over is read from the browser and visited here.
function startView(adminToken: string, playerId: string) {
  cy.visitSignedIn(`/admin/players/${playerId}`, adminToken)
  cy.window().then((win) =>
    cy
      .stub(win, 'open')
      .as('openTab')
      .returns({} as Window)
  )
  cy.contains('button', 'View as player').click()
  cy.get('.ant-modal textarea').type(REASON)
  cy.get('.ant-modal').contains('button', 'Confirm').click()
  cy.get('.ant-modal').should('not.exist')
  cy.get('@openTab').should('have.been.calledWith', '/game?view-as=1', '_blank')
  cy.visit('/game?view-as=1')
}

const viewerToken = () =>
  cy.window().then((win) => JSON.parse(win.sessionStorage.getItem('viewAs') as string).token as string)

describe('viewing the game as a player', () => {
  it('shows the player’s game read-only under a banner, refuses every change, audits it, and ends with the exit', () => {
    cy.createPlayer().then((player) => {
      cy.deployBaseViaApi(player.token).then(() => {
        cy.createAdmin('admin').then(({ token: adminToken }) => {
          cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) }).then((me) => {
            const playerId = (me.body as { _id: string })._id

            startView(adminToken, playerId)

            cy.contains('You are viewing the game of')
            cy.contains('read-only')
            cy.contains('commands are not available')

            viewerToken().then((token) => {
              cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(token) })
                .its('body.email')
                .should('eq', player.email)
              cy.apiRequest({
                method: 'POST',
                path: '/api/v1/bots/base',
                headers: bearer(token),
                body: {},
                failOnStatusCode: false
              }).then((refused) => {
                expect(refused.status).to.eq(403)
                expect((refused.body as { code: string }).code).to.eq('VIEW_AS_READ_ONLY')
              })
              cy.apiRequest({ path: '/api/v1/admin/me', headers: bearer(token), failOnStatusCode: false })
                .its('status')
                .should('eq', 403)

              cy.createAdmin('owner').then(({ token: ownerToken }) => {
                cy.apiRequest({
                  path: `/api/v1/admin/audit?action=players.view-as.start&targetId=${playerId}`,
                  headers: bearer(ownerToken)
                }).then((trail) => {
                  const [entry] = (trail.body as { result: Array<{ reason: string; actorRole: string }> }).result
                  expect(entry).to.include({ reason: REASON, actorRole: 'admin' })
                })
              })

              cy.contains('button', 'Exit').click()
              cy.location('pathname').should('eq', '/admin/players')
              cy.window().then((win) => expect(win.sessionStorage.getItem('viewAs')).to.eq(null))
              cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(token), failOnStatusCode: false })
                .its('status')
                .should('eq', 401)
              cy.createAdmin('owner').then(({ token: ownerToken }) => {
                cy.apiRequest({
                  path: `/api/v1/admin/audit?action=players.view-as.end&targetId=${playerId}`,
                  headers: bearer(ownerToken)
                })
                  .its('body.result')
                  .should('have.length', 1)
              })
            })
          })
        })
      })
    })
  })

  it('leaves the admin’s own session alone', () => {
    cy.createPlayer().then((player) => {
      cy.createAdmin('admin').then(({ token: adminToken }) => {
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) }).then((me) => {
          startView(adminToken, (me.body as { _id: string })._id)
          cy.contains('You are viewing the game of')

          cy.window().then((win) => expect(win.localStorage.getItem('token')).to.eq(adminToken))
          cy.apiRequest({ path: '/api/v1/admin/me', headers: bearer(adminToken) })
            .its('status')
            .should('eq', 200)
        })
      })
    })
  })

  it('is offered to owners and admins, not to moderators or analysts', () => {
    cy.createPlayer().then((player) => {
      cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) }).then((me) => {
        const playerId = (me.body as { _id: string })._id

        for (const role of ['owner', 'admin'] as const) {
          cy.createAdmin(role).then(({ token }) => {
            cy.visitSignedIn(`/admin/players/${playerId}`, token)
            cy.contains('button', 'View as player')
          })
        }
        cy.createAdmin('moderator').then(({ token }) => {
          cy.visitSignedIn(`/admin/players/${playerId}`, token)
          cy.contains('button', 'Ban')
          cy.contains('button', 'View as player').should('not.exist')
          cy.apiRequest({
            method: 'POST',
            path: `/api/v1/admin/players/${playerId}/view-as`,
            headers: bearer(token),
            body: { reason: REASON },
            failOnStatusCode: false
          })
            .its('status')
            .should('eq', 403)
        })
      })
    })
  })
})
