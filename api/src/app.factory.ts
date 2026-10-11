import { ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AppConfig } from './config/app-config'
import { LOGGER, Logger } from './shared/application/logger'
import { ForbiddenError, ValidationError } from './shared/domain/errors'
import { AppExceptionFilter } from './shared/presentation/app-exception.filter'
import { ConfiguredIoAdapter } from './shared/presentation/configured-io.adapter'
import { createRequestLogger } from './shared/presentation/request-logger.middleware'

function isAllowedOrigin(origin: string | undefined, allowed: string[]) {
  return !origin || allowed.includes(origin)
}

export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: ['error', 'warn']
  })

  return configureApp(app, config)
}

// Everything that turns a Nest application into the API; shared by the real server and the tests
export async function configureApp(app: NestExpressApplication, config: AppConfig): Promise<NestExpressApplication> {
  const logger = app.get<Logger>(LOGGER)

  app.use(helmet())
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
      isAllowedOrigin(origin, config.corsOrigins)
        ? callback(null, true)
        : callback(new ForbiddenError('Origin is not allowed')),
    credentials: true
  })
  app.use(cookieParser())
  app.use(createRequestLogger(logger))
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config.adminUrl))

  app.set('trust proxy', config.trustProxy)
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        // The DTOs are flat, so every failed property has constraints
        new ValidationError(errors.flatMap((error) => Object.values(error.constraints as object)).join('; '))
    })
  )
  app.useGlobalFilters(new AppExceptionFilter(logger))

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Bot RTS API').setVersion('1').build())
  )

  await app.init()

  return app
}
