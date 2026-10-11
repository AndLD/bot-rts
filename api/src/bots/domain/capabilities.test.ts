import { buildModule } from '../../../tests/integration/builders'
import { GameModule } from '../../modules/domain/game-module'
import { createModuleRegistry } from '../../modules/domain/module-registry'
import { canConnect, canRunScripts } from './capabilities'

const registry = createModuleRegistry()
const modules = (...specs: [string, number?][]): GameModule[] =>
  specs.map(([type, condition = 100]) => registry.instantiate(buildModule('bot', { type: type as never, condition })))

describe('bot capabilities', () => {
  it('runs scripts only with a working processor', () => {
    expect(canRunScripts(modules(['processor']))).toBe(true)
    expect(canRunScripts(modules(['processor', 0]))).toBe(false)
    expect(canRunScripts(modules(['processor', 0], ['processor']))).toBe(true)
    expect(canRunScripts(modules(['battery']))).toBe(false)
    expect(canRunScripts([])).toBe(false)
  })

  it('connects only with a working wireless adapter', () => {
    expect(canConnect(modules(['wirelessAdapter']))).toBe(true)
    expect(canConnect(modules(['wirelessAdapter', 0]))).toBe(false)
    expect(canConnect(modules(['processor']))).toBe(false)
  })
})
