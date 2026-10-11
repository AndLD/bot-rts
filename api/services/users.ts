import bcrypt from 'bcrypt'
import { Response } from 'express'
import { Entity, rootUser as rootUserConfig } from '../utils/constants'
import { IUser, IUserPost, IUserPostBody, IUserPutBody, IUsersFilter, UserStatus } from '@lib/utils/interfaces/users'
import { getKeywords } from '../utils/keywords'
import { getLogger } from '../utils/logger'
import { db, usersCollection } from './db'
import { ObjectId } from 'mongodb'
import { ID } from '@lib/utils/types'

const logger = getLogger('services/users')

const entity = Entity.USERS

async function countUsersByState(res: Response) {
  const raws: {
    _id: ID
    status?: UserStatus
  }[] = await usersCollection.find({}, { projection: { status: 1 } }).toArray()

  const users = {
    admin: 0,
    owner: 0,
    user: 0,
    unlimited: 0,
    banned: 0
  }

  for (const raw of raws) {
    users[raw.status as UserStatus]++
  }

  return users
}

async function getRootUser() {
  const rootUser: IUser | null = await usersCollection.findOne({
    email: rootUserConfig.email
  })

  // If root user not found, create it
  if (!rootUser) {
    if (!rootUserConfig.password) {
      throw new Error('Root user password not found!')
    }

    const user = await usersService.addUser(rootUserConfig as IUserPostBody, ROOT_OPTIONS)

    logger.info('Root user created.')

    return user
  }

  return rootUser as IUser
}

interface AddUserOptions {
  status: UserStatus
  isActive: boolean
}

const SIGNUP_OPTIONS: AddUserOptions = { status: 'user', isActive: false }
const ROOT_OPTIONS: AddUserOptions = { status: 'admin', isActive: true }

async function addUser(body: IUserPostBody, options: AddUserOptions = SIGNUP_OPTIONS): Promise<IUser> {
  const hashedPassword: string = await bcrypt.hash(body.password, 10)

  const userObj: IUserPost = {
    ...body,
    password: hashedPassword,
    status: options.status,
    active: options.isActive,
    subscription: 'free',
    keywords: getKeywords(body.email, body.name),
    createdAt: Date.now()
  }

  const result = await db.collection(entity).insertOne(userObj)

  return (await findUserById(result.insertedId.toString())) as IUser
}

async function findUserById(id: string): Promise<IUser | null> {
  return await usersCollection.findOne({ _id: new ObjectId(id) })
}

async function getUserByEmail(email: string): Promise<IUser | null> {
  return await usersCollection.findOne({ email })
}

async function activateUser(userId: string): Promise<IUser | null> {
  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(userId), active: false },
    { $set: { active: true } },
    { returnDocument: 'after', upsert: false }
  )

  return result.value
}

const USER_UPDATE_FIELDS = ['name', 'subscription', 'status', 'active', 'password'] as const

async function updateUser(id: string, update: IUserPutBody): Promise<IUser | null> {
  const set: Record<string, unknown> = { updatedAt: Date.now() }

  for (const field of USER_UPDATE_FIELDS) {
    if (update[field] !== undefined) {
      set[field] = field === 'password' ? await bcrypt.hash(update.password as string, 10) : update[field]
    }
  }

  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: set },
    { returnDocument: 'after' }
  )

  return result.value
}

async function listUsers(filter: IUsersFilter, skip: number, limit: number) {
  const users = await usersCollection
    .find(filter, { projection: { password: 0, keywords: 0 } })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .toArray()
  const total = await usersCollection.countDocuments(filter)

  return { users, total }
}

// Delete inactive users older 24 hours
async function deleteInactiveUsers() {
  const result = await db.collection(entity).deleteMany({
    active: false,
    createdAt: { $lt: Date.now() - 24 * 60 * 60 * 1000 }
  })

  logger.info(`Cron: Deleted inactive users older 24 hours: ${result.deletedCount}`)
}

export const usersService = {
  countUsersByState,
  getRootUser,
  addUser,
  activateUser,
  deleteInactiveUsers,
  getUserByEmail,
  findUserById,
  updateUser,
  listUsers
}
