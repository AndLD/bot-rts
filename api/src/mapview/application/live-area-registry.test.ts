import { EngineEvent } from '../../engine/application/engine-ports'
import { LiveAreaRegistry } from './live-area-registry'

const area = { scannerId: 's', botId: 'b', x: 1, y: 2, radius: 3 }

function setup() {
  let listener: (event: EngineEvent) => void = () => undefined
  const off = jest.fn()
  const registry = new LiveAreaRegistry({
    onEvent: (callback) => {
      listener = callback
      return off
    }
  })
  registry.start()

  return { registry, emit: (event: EngineEvent) => listener(event), off }
}

describe('LiveAreaRegistry', () => {
  it('follows the announcements of the engine', () => {
    const { registry, emit } = setup()
    expect(registry.areasOf('u')).toEqual([])

    emit({ type: 'live-areas', userId: 'u', areas: [area] })
    expect(registry.areasOf('u')).toEqual([area])
    expect(registry.areasOf('other')).toEqual([])

    emit({ type: 'live-areas', userId: 'u', areas: [] })
    expect(registry.areasOf('u')).toEqual([])
  })

  it('ignores other events and stops listening', () => {
    const { registry, emit, off } = setup()
    emit({ type: 'radio', userId: 'u', changes: [] })
    expect(registry.areasOf('u')).toEqual([])

    registry.stop()
    registry.stop()
    expect(off).toHaveBeenCalledTimes(1)
  })
})
