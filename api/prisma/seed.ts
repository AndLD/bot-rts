import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { PrismaUserRepository } from '../src/users/infrastructure/prisma-user.repository'

// Creates the root administrator from ROOT_USER_EMAIL / ROOT_USER_PASSWORD; safe to run repeatedly
async function main() {
  const email = process.env.ROOT_USER_EMAIL || 'root@root.root'
  const password = process.env.ROOT_USER_PASSWORD

  if (!password) {
    throw new Error('ROOT_USER_PASSWORD is not set')
  }

  const client = new PrismaClient()

  try {
    const users = new PrismaUserRepository(client)

    if (await users.findByEmail(email)) {
      process.stdout.write(`Root user ${email} already exists` + '\n')
      return
    }

    await users.add({
      id: randomUUID(),
      name: 'Root',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'owner',
      isActive: true,
      subscription: 'free',
      createdAt: new Date(),
      updatedAt: null
    })
    process.stdout.write(`Root user ${email} created` + '\n')
  } finally {
    await client.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
