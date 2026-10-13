import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { BcryptPasswordHasher } from '../src/auth/infrastructure/bcrypt-password-hasher'
import { LOCAL_PROVIDER } from '../src/auth/domain/identity'
import { PRIVACY_POLICY_VERSION } from '../../lib/utils/privacy'
import { PrismaUnitOfWork } from '../src/persistence/infrastructure/prisma-unit-of-work'

// Creates the root owner with a verified email from ROOT_USER_EMAIL / ROOT_USER_PASSWORD; safe to run repeatedly
async function main() {
  const email = (process.env.ROOT_USER_EMAIL || 'root@root.root').toLowerCase()
  const password = process.env.ROOT_USER_PASSWORD

  if (!password) {
    throw new Error('ROOT_USER_PASSWORD is not set')
  }

  const client = new PrismaClient()

  try {
    const passwordHash = await new BcryptPasswordHasher().hash(password)
    const created = await new PrismaUnitOfWork(client).run(async ({ users, identities, credentials }) => {
      if (await users.findByEmail(email)) {
        return false
      }

      const now = new Date()
      const id = randomUUID()
      await users.add({
        id,
        name: 'Root',
        email,
        status: 'owner',
        subscription: 'free',
        privacyAcceptedVersion: PRIVACY_POLICY_VERSION,
        privacyAcceptedAt: now,
        createdAt: now,
        updatedAt: null,
        deletedAt: null
      })
      await identities.add({ id: randomUUID(), provider: LOCAL_PROVIDER, subject: id, userId: id, createdAt: now })
      await credentials.add({ userId: id, passwordHash, emailVerified: true, updatedAt: now })

      return true
    })

    process.stdout.write(`Root user ${email} ${created ? 'created' : 'already exists'}\n`)
  } finally {
    await client.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
