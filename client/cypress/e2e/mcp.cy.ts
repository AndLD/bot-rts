import { eventually, newEmail } from '../support/commands'

// A bot that can look and drive
const DRIVER = [
  'processor-class1',
  'memory-class1',
  'wireless-adapter-class1',
  'battery-class1',
  'scanner-class1',
  'engine-class1',
  'wheels-class1'
]

describe('an AI playing through the MCP server', () => {
  it('scans and moves a bot with a key, and is refused what the key does not allow', () => {
    const email = newEmail()
    cy.createPlayer(email).then(({ token }) => {
      cy.deployBaseViaApi(token).then(({ id: baseId, at }) => {
        cy.assembleWorker({ email, token, baseId, modules: DRIVER, label: 'Scout' }).then((botId) => {
          cy.task('placeBotAt', { botId, x: at.x + 8, y: at.y + 8 })
          cy.apiRequest({
            method: 'POST',
            path: `/api/v1/bots/${baseId}/scan`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false
          })

          // The AI may look and move, nothing else
          cy.createApiKey({ token, name: 'ai', scopes: ['read', 'movement'] }).then((apiKey) => {
            cy.task<Record<string, { isError: boolean; text: string }>>(
              'mcpSmoke',
              { apiKey, botId },
              { timeout: 90000 }
            ).then((answers) => {
              expect(answers.bots.isError, answers.bots.text).to.equal(false)
              expect(JSON.parse(answers.bots.text).map((bot: { _id: string }) => bot._id)).to.include(botId)

              expect(answers.scan.isError, answers.scan.text).to.equal(false)
              expect(answers.move.isError, answers.move.text).to.equal(false)
              expect(JSON.parse(answers.move.text).ok).to.equal(true)

              expect(answers.denied.isError).to.equal(true)
              expect(answers.denied.text).to.contain('API_KEY_SCOPE')
            })

            // The bot really moved one cell, which the database of the game shows
            eventually(
              () => cy.task<{ x: number; y: number } | null>('positionOf', { botId }),
              (position) => position !== null && (position.x !== at.x + 8 || position.y !== at.y + 8)
            ).then((position) => {
              expect(Math.abs(position!.x - (at.x + 8)) + Math.abs(position!.y - (at.y + 8))).to.equal(1)
            })
          })
        })
      })
    })
  })
})
