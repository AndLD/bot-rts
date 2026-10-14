import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Server } from 'http'
import { AppModule } from './app.module'
import { REFRESH_COOKIE } from './auth/presentation/refresh-cookie'
import { AppConfig } from './config/app-config'
import { LOGGER, Logger } from './shared/application/logger'
import { ValidationError } from './shared/domain/errors'
import { AppExceptionFilter } from './shared/presentation/app-exception.filter'
import { ConfiguredIoAdapter } from './shared/presentation/configured-io.adapter'
import { HttpMetrics } from './metrics/application/http-metrics'
import { REDIS_CONNECTOR, RedisConnector } from './redis/redis.module'
import { RequestTimeoutInterceptor } from './shared/presentation/request-timeout.interceptor'
import { corsOptions, helmetOptions } from './shared/presentation/security-headers'
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

// The OpenAPI document of the public API (AGENTS.md §3.0). The operation ids are `<controller><Method>`, for example
// `authLogin`, which is what the generated web client names its endpoints after.
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Bot RTS API')
    .setDescription('The one API of the game: the web client, third-party clients and the MCP server use it.')
    .setVersion('1')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)

  return SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey, methodKey) => {
      const controller = controllerKey.replace(/Controller$/, '')
      return `${controller[0].toLowerCase()}${controller.slice(1)}${methodKey[0].toUpperCase()}${methodKey.slice(1)}`
    }
  })
}

// Everything that turns a Nest application into the API; shared by the real server and the tests
export async function configureApp(app: NestExpressApplication, config: AppConfig): Promise<NestExpressApplication> {
  const logger = app.get<Logger>(LOGGER)

  const server = app.getHttpServer() as Server
  server.requestTimeout = config.http.requestTimeoutMs
  server.headersTimeout = config.http.headersTimeoutMs
  server.keepAliveTimeout = config.http.keepAliveTimeoutMs

  app.use(helmet(helmetOptions(config.nodeEnv === 'production')))
  app.enableCors(corsOptions((origin) => isAllowedOrigin(origin, config.corsOrigins)))
  app.useBodyParser('json', { limit: config.http.bodyLimitBytes })
  app.use(cookieParser())
  const httpMetrics = app.get(HttpMetrics)
  app.use(createRequestLogger(logger, (request) => httpMetrics.observe(request)))
  const connect = app.get<RedisConnector>(REDIS_CONNECTOR)
  app.useWebSocketAdapter(
    new ConfiguredIoAdapter(app, config.adminUrl, connect ? { publisher: connect(), subscriber: connect() } : undefined)
  )

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
  app.useGlobalInterceptors(new RequestTimeoutInterceptor(config.http.handlerTimeoutMs))
  app.useGlobalFilters(new AppExceptionFilter(logger))

  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app))

  await app.init()

  return app
}
