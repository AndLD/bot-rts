import request from 'supertest'
import { totpCodeAt } from '../../src/admin/infrastructure/crypto-totp'
import { SignedUp, signUpVerified, TestApp } from './test-app'
import { TestDatabase } from './test-database'

export type AdminStatus = 'owner' | 'admin' | 'moderator' | 'analyst'

let counter = 0

// A verified player given an admin role, with the second factor set up and verified in the session of the returned token
export async function signUpAdmin(testApp: TestApp, database: TestDatabase, status: AdminStatus): Promise<SignedUp> {
  counter += 1
  const player = await signUpVerified(testApp, database, `${status}${counter}@admin.example`)
  await database.client.user.update({ where: { id: player.userId }, data: { status } })
  const bearer = { Authorization: `Bearer ${player.accessToken}` }
  const begun = await request(testApp.url).post('/api/v1/admin/2fa/enroll').set(bearer).expect(201)
  await request(testApp.url)
    .post('/api/v1/admin/2fa/confirm')
    .set(bearer)
    .send({ code: totpCodeAt(begun.body.secret, Date.now()) })
    .expect(200)

  return player
}
