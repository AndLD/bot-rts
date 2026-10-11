import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { CLOCK, Clock } from '../shared/application/clock'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { EMAIL_SENDER, EmailSender } from '../notifications/application/email-sender'
import { NotificationsModule } from '../notifications/notifications.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { PASSWORD_HASHER, PasswordHasher } from './application/password-hasher'
import { USER_REPOSITORY, UserRepository } from './application/user.repository'
import { UsersService } from './application/users.service'
import { VerificationMailer } from './application/verification-mailer'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher'
import { PrismaUserRepository } from './infrastructure/prisma-user.repository'

@Module({
  imports: [NotificationsModule],
  providers: [
    {
      provide: USER_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaUserRepository(client)
    },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    {
      provide: UsersService,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, CLOCK],
      useFactory: (users: UserRepository, hasher: PasswordHasher, ids: IdGenerator, clock: Clock) =>
        new UsersService(users, hasher, ids, clock)
    },
    {
      provide: VerificationMailer,
      inject: [EMAIL_SENDER, APP_CONFIG],
      useFactory: (sender: EmailSender | undefined, config: AppConfig) =>
        new VerificationMailer(sender, config.frontendUrl)
    }
  ],
  exports: [UsersService, VerificationMailer]
})
export class UsersModule {}
