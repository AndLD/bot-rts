import { createApp } from './app.factory'
import { loadConfig } from './config/app-config'
import { LOGGER, Logger } from './shared/application/logger'

export async function bootstrap(env: Record<string, string | undefined>) {
  const config = loadConfig(env)
  const app = await createApp(config)

  app.enableShutdownHooks()
  await app.listen(config.port)
  app.get<Logger>(LOGGER).info(`Server has been started on ${config.port}, env=${config.nodeEnv}`)

  return app
}
