import { routedThroughEngine, throughEngine } from './route-through-engine'

class Counter {
  readonly name = 'counter'
  async read() {
    return `read by ${this.name}`
  }
  async write(what: string) {
    return `wrote ${what} here`
  }
}

describe('routedThroughEngine', () => {
  it('sends the listed methods to the engine and keeps running the others here', async () => {
    const port = { act: jest.fn(async () => 'by the engine') }
    const service = new Counter()

    const routed = routedThroughEngine(service, port as never, true, { write: 'files.write' })

    await expect(routed.write('x')).resolves.toBe('by the engine')
    expect(port.act).toHaveBeenCalledWith('files.write', ['x'])
    await expect(routed.read()).resolves.toBe('read by counter')
  })

  it('hands the service itself back when there is no engine', async () => {
    const service = new Counter()

    expect(routedThroughEngine(service, { act: jest.fn() } as never, false, { write: 'files.write' })).toBe(service)
  })

  it('makes a single use case a function of the engine', async () => {
    const port = { act: jest.fn(async () => 7) }

    await expect(throughEngine(port as never, 'factory.craft')('u', 'b', 'm')).resolves.toBe(7)
    expect(port.act).toHaveBeenCalledWith('factory.craft', ['u', 'b', 'm'])
  })
})
