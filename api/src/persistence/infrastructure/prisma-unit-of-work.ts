import { PrismaClient } from '@prisma/client'
import { Repositories, UnitOfWork } from '../application/unit-of-work'
import { createPrismaRepositories } from './prisma-repositories'

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => work(createPrismaRepositories(tx)))
  }
}
