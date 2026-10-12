import { join } from 'path'
import { Worker } from 'worker_threads'
import { AppConfig } from '../../config/app-config'
import { WorkerLike } from './engine-process'

// Starts the engine thread (design §12.2.2). The compiled server runs the built .js file; during development and in the
// tests the TypeScript source is run through ts-node.
export function spawnEngineWorker(config: AppConfig): WorkerLike {
  const entry = join(__dirname, 'engine-worker')
  // Plain data only: functions and class instances do not cross the thread boundary
  const workerData = JSON.parse(JSON.stringify(config))
  if (__filename.endsWith('.ts')) {
    const source = `require('ts-node/register/transpile-only'); require(${JSON.stringify(`${entry}.ts`)})`
    return new Worker(source, { eval: true, workerData }) as unknown as WorkerLike
  }
  return new Worker(`${entry}.js`, { workerData }) as unknown as WorkerLike
}
