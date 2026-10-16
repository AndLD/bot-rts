import { GatewayMetricSource } from './gateway-metric.source'

describe('GatewayMetricSource', () => {
  it('reports whether the gateway is up and its queue', async () => {
    expect(await new GatewayMetricSource({ read: async () => ({ isUp: true, queueSize: 4 }) }).read()).toEqual({
      values: { 'infrastructure.gatewayUp': 1, 'infrastructure.gatewayQueueSize': 4 }
    })
  })

  it('leaves out a queue it could not read', async () => {
    expect(await new GatewayMetricSource({ read: async () => ({ isUp: false, queueSize: null }) }).read()).toEqual({
      values: { 'infrastructure.gatewayUp': 0 }
    })
  })
})
