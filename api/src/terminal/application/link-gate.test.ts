import { NoSignalError } from '../../engine/application/radio-network'
import { EngineLinkGate } from '../../engine/infrastructure/engine-link-gate'
import { OpenLinkGate } from './link-gate'

describe('link gates', () => {
  it('lets everyone through when there is no engine to know the network', async () => {
    await expect(new OpenLinkGate().ensureConnected()).resolves.toBeUndefined()
  })

  it('asks the engine and refuses a bot out of reach with NO_SIGNAL', async () => {
    const engine = { linkStatus: jest.fn() }
    const gate = new EngineLinkGate(engine)
    engine.linkStatus.mockResolvedValueOnce({ isConnected: true, signal: 3, hops: 1 })
    engine.linkStatus.mockResolvedValueOnce({ isConnected: false, signal: 0, hops: 0 })

    await expect(gate.ensureConnected('u', 'b')).resolves.toBeUndefined()
    await expect(gate.ensureConnected('u', 'b')).rejects.toBeInstanceOf(NoSignalError)
    expect(engine.linkStatus).toHaveBeenCalledWith('u', 'b')
  })
})
