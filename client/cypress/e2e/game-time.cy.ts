import { clockTextOf, configOf, DEFAULT_GAME_TIME_SETTINGS } from '../../../lib/utils/game-time'

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const REASON = 'checked by the end-to-end suite'

const STOCK = [
  { resource: 'iron', amount: 600 },
  { resource: 'crystal', amount: 400 },
  { resource: 'gold', amount: 100 },
  { resource: 'oil', amount: 50 }
]

// The clock in the corner of the game screen, as "HH:MM"
const gameClockText = () => cy.get('[data-testid=game-clock]').invoke('text')

describe('the game time controls', () => {
  let ownerToken: string

  beforeEach(() => {
    cy.task('resetGameTime')
    cy.createAdmin('owner').then(({ token }) => {
      ownerToken = token
    })
  })
  afterEach(() => {
    cy.task('resetGameTime')
  })

  const adminPost = (path: string, body: object) =>
    cy.apiRequest({
      method: 'POST',
      path: `/api/v1/admin/game-time/${path}`,
      headers: bearer(ownerToken),
      body: { reason: REASON, ...body }
    })

  it('changes the day from the console, and the clock of a player who has the game open follows without a reload', () => {
    cy.createPlayer().then((player) => {
      cy.deployBaseViaApi(player.token)
      cy.visitSignedIn('/game', player.token)
      gameClockText().should('match', /^\d\d:\d\d/)

      adminPost('time-of-day', { minuteOfDay: 5 * 60 })
        .its('status')
        .should('eq', 200)

      gameClockText().should('match', /^05:\d\d/)
      cy.contains('The time of the game was changed by an admin.')

      adminPost('time-of-day', { minuteOfDay: 16 * 60 + 30 })
        .its('status')
        .should('eq', 200)
      gameClockText().should('match', /^16:3\d/)
    })
  })

  it('changes the length of the day without a jump of the time of day, from the page of the console', () => {
    adminPost('time-of-day', { minuteOfDay: 12 * 60 })
      .its('status')
      .should('eq', 200)
    cy.visitSignedIn('/admin/game-time', ownerToken)
    cy.get('[data-testid=game-time-clock]').invoke('text').as('before')

    cy.contains('button', '6 h 30 min').click()
    cy.get('.ant-modal textarea').type(REASON)
    cy.get('.ant-modal').contains('button', 'Confirm').click()
    cy.get('.ant-modal').should('not.exist')

    cy.contains('Day cycle of 6 h 30 min')
    cy.get('@before').then((before) => {
      cy.get('[data-testid=game-time-clock]')
        .invoke('text')
        .should((after) => {
          // The clock goes on from where it was, at the new speed: a few game minutes at most
          const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5))
          expect(minutes(after) - minutes(String(before))).to.be.within(0, 30)
        })
    })
  })

  it('shows the real-world time of a zone, and goes back to the cycle', () => {
    cy.apiRequest({
      method: 'POST',
      path: '/api/v1/admin/game-time/real-world',
      headers: bearer(ownerToken),
      body: { timeZone: 'Europe/Kyiv', reason: REASON }
    })
      .its('body')
      .then((body) => {
        const { settings, config, now } = body as {
          settings: object
          config: Parameters<typeof clockTextOf>[1]
          now: number
        }
        expect(settings).to.include({ mode: 'realWorld', timeZone: 'Europe/Kyiv' })
        expect(clockTextOf(now, config)).to.match(/^\d\d:\d\d$/)
        const hourInKyiv = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Kyiv',
          hour: '2-digit',
          hourCycle: 'h23'
        }).format(new Date(now))
        expect(clockTextOf(now, config).slice(0, 2)).to.eq(hourInKyiv)
      })

    cy.createPlayer().then((player) => {
      cy.deployBaseViaApi(player.token)
      cy.visitSignedIn('/game', player.token)
      gameClockText().should('match', /^\d\d:\d\d/)
    })
    adminPost('cycle', {}).its('body.settings.mode').should('eq', 'cycle')
    expect(clockTextOf(0, configOf(DEFAULT_GAME_TIME_SETTINGS))).to.eq('00:00')
  })

  it('advances the clock on a test server so that a craft finishes without waiting', () => {
    const email = `clock-${Date.now()}@example.com`

    cy.createPlayer(email).then((player) => {
      cy.deployBaseViaApi(player.token).then((base) => {
        cy.task('stockBase', { email, items: STOCK })
        const factory = `/api/v1/bots/${base.id}/factory`
        cy.apiRequest({
          method: 'POST',
          path: `${factory}/craft`,
          headers: bearer(player.token),
          body: { module: 'battery-class1' }
        })
          .its('status')
          .should('eq', 201)
        cy.apiRequest({ path: factory, headers: bearer(player.token) })
          .its('body.parts')
          .should('have.length', 0)

        cy.apiRequest({
          method: 'POST',
          path: '/api/v1/admin/devtools/advance-clock',
          headers: bearer(ownerToken),
          body: { stepMs: 3_600_000, reason: REASON }
        })
          .its('body.settings.offsetMs')
          .should('eq', 3_600_000)

        cy.apiRequest({ path: factory, headers: bearer(player.token) })
          .its('body.parts')
          .should('have.length', 1)
        // The player's session is on the real clock: the token still works
        cy.apiRequest({ path: '/api/v1/users/me', headers: bearer(player.token) })
          .its('status')
          .should('eq', 200)
      })
    })
  })

  it('is for owners and admins, and the advance only for owners', () => {
    cy.createAdmin('moderator').then(({ token }) => {
      cy.visitSignedIn('/admin/game-time', token)
      cy.contains('You can read the game time')
      cy.contains('button', '48 min').should('not.exist')
    })
    cy.createAdmin('admin').then(({ token }) => {
      cy.visitSignedIn('/admin/game-time', token)
      cy.contains('button', '48 min')
      cy.contains('button', '+1 hour').should('not.exist')
    })
    cy.visitSignedIn('/admin/game-time', ownerToken)
    cy.contains('button', '+1 hour')
  })
})
