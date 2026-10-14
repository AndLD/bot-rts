import { ConfigError, loadConfig } from './config'

const key = { BOTRTS_API_KEY: 'botrts_abc' }

describe('loadConfig', () => {
  it('defaults to stdio against a local game', () => {
    expect(loadConfig(key)).toEqual({
      apiUrl: 'http://localhost:8080',
      apiKey: 'botrts_abc',
      transport: 'stdio',
      http: { host: '127.0.0.1', port: 3000 }
    })
  })

  it('reads the address, the transport and the port, and drops a trailing slash', () => {
    expect(
      loadConfig({
        BOTRTS_API_URL: 'https://play.example//',
        MCP_TRANSPORT: 'http',
        MCP_HOST: '0.0.0.0',
        MCP_PORT: '8099'
      })
    ).toEqual({
      apiUrl: 'https://play.example',
      apiKey: undefined,
      transport: 'http',
      http: { host: '0.0.0.0', port: 8099 }
    })
  })

  it('needs a key for stdio, and says where to get one', () => {
    expect(() => loadConfig({})).toThrow(/BOTRTS_API_KEY is required/)
    expect(() => loadConfig({ BOTRTS_API_KEY: '' })).toThrow(ConfigError)
  })

  it('lists every problem at once', () => {
    try {
      loadConfig({ MCP_TRANSPORT: 'smoke', BOTRTS_API_KEY: 'sk-not-ours', MCP_PORT: 'many' })
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as ConfigError).problems).toEqual([
        'MCP_TRANSPORT must be stdio or http',
        'BOTRTS_API_KEY does not look like an API key (botrts_…)',
        'MCP_PORT must be an integer between 0 and 65535'
      ])
    }
  })
})
