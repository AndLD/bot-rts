import { PRIVACY_POLICY_VERSION } from '../../../lib/utils/privacy'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { AddressInfo } from 'net'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.factory'
import { loadConfig } from '../../src/config/app-config'
import { EmailMessage, EMAIL_SENDER, EmailSender } from '../../src/notifications/application/email-sender'
import { urlForDatabase } from './database-url'
import { TestDatabase } from './test-database'

export class RecordingEmailSender implements EmailSender {
  readonly messages: EmailMessage[] = []

  async send(message: EmailMessage) {
    this.messages.push(message)
  }

  close() {}

  // The secret of the link in the last message to the address
  tokenFor(to: string): string {
    const message = [...this.messages].reverse().find((m) => m.to === to)
    const token = message && /token=([^"&]+)/.exec(message.html)?.[1]

    if (!token) {
      throw new Error(`No email with a link was sent to ${to}`)
    }

    return decodeURIComponent(token)
  }
}

export interface TestApp {
  app: NestExpressApplication
  url: string
  emails: RecordingEmailSender
  close(): Promise<void>
}

// The whole application on a random port, wired to the test database and a recording mail sender
export async function startTestApp(
  database: TestDatabase,
  env: Record<string, string> = {},
  // Providers to replace with fakes, by token
  overrides: Array<{ provide: unknown; useValue: unknown }> = []
): Promise<TestApp> {
  const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
  const config = loadConfig({
    DATABASE_URL: urlForDatabase(db),
    NODE_ENV: 'test',
    WHITELIST_URLS: 'https://play.example',
    RATE_LIMIT_AUTH_MAX: '1000',
    ...env
  })
  const emails = new RecordingEmailSender()
  let builder = Test.createTestingModule({ imports: [AppModule.register(config)] })
    .overrideProvider(EMAIL_SENDER)
    .useValue(emails)
  for (const { provide, useValue } of overrides) {
    builder = builder.overrideProvider(provide).useValue(useValue)
  }
  const module = await builder.compile()
  const app = await configureApp(module.createNestApplication<NestExpressApplication>(), config)

  await app.listen(0)

  return {
    app,
    emails,
    url: `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`,
    close: () => app.close()
  }
}

export interface SignedUp {
  userId: string
  email: string
  accessToken: string
  cookie: string[]
}

export const PASSWORD = 'Passw0rd!x'

// Registers a player and walks through the emailed verification link
export async function signUpVerified(
  testApp: TestApp,
  database: TestDatabase,
  email: string,
  name = 'Alice'
): Promise<SignedUp> {
  await request(testApp.url)
    .post('/api/v1/auth/register')
    .send({ name, email, password: PASSWORD, acceptedPrivacyVersion: PRIVACY_POLICY_VERSION })
    .expect(201)
  await request(testApp.url)
    .post('/api/v1/auth/email/verify')
    .send({ token: testApp.emails.tokenFor(email) })
    .expect(204)
  const login = await request(testApp.url).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200)
  const user = await database.client.user.findUniqueOrThrow({ where: { email } })

  return {
    userId: user.id,
    email,
    accessToken: login.body.accessToken,
    cookie: login.headers['set-cookie'] as unknown as string[]
  }
}
