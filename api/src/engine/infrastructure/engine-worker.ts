import { NestFactory } from '@nestjs/core'
import { parentPort, workerData } from 'worker_threads'
import { AppConfig } from '../../config/app-config'
import { ControlMessage, EngineMessage, MessageChannel } from '../application/engine-protocol'
import { EngineWorkerModule } from '../engine-worker.module'
import { EngineHost } from './engine-host'

// Entry point of the engine thread: builds the application context the engine's use cases live in and starts the host. It
// runs only inside a worker thread, started by `spawnEngineWorker`.
async function main() {
  const port = parentPort
  if (!port) {
    throw new Error('The engine must run in a worker thread')
  }
  const channel: MessageChannel<ControlMessage, EngineMessage> = {
    post: (message) => port.postMessage(message),
    onMessage: (handler) => void port.on('message', handler)
  }
  const app = await NestFactory.createApplicationContext(
    EngineWorkerModule.register(workerData as AppConfig, channel),
    { logger: ['error', 'warn'] }
  )
  await app.get(EngineHost).start()
}

main().catch((error) => {
  console.error('The engine failed to start', error)
  process.exit(1)
})
