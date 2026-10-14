import { API_SCOPES } from '../../../lib/utils/interfaces/api-keys'
import { ApiClient } from '../api-client'
import { fakeApi } from '../test-support'
import { toolOf } from './actions'
import { allTools } from './index'

const ID = '11111111-1111-4111-8111-111111111111'

// What each tool does on the API: the request it makes for an input
const REQUESTS: Array<[string, Record<string, unknown>, string, string, unknown?]> = [
  ['get_me', {}, 'GET', '/users/me'],
  ['list_bots', {}, 'GET', '/bots'],
  ['list_bots', { type: 'base' }, 'GET', '/bots?type=base'],
  ['list_base_bots', { baseId: ID }, 'GET', `/bots/${ID}/bots`],
  ['get_bot_modules', { botId: ID }, 'GET', `/bots/${ID}/modules`],
  ['get_storage', { botId: ID }, 'GET', `/bots/${ID}/storage`],
  ['get_map', { minX: 0, minY: 1, maxX: 2, maxY: 3 }, 'GET', '/map?minX=0&minY=1&maxX=2&maxY=3'],
  ['get_bot_view', { botId: ID }, 'GET', `/map/bots/${ID}`],
  ['get_terminal_history', { botId: ID, limit: 20 }, 'GET', `/bots/${ID}/terminal-history?limit=20`],
  ['list_notifications', { unread: true }, 'GET', '/notifications?unread=true'],
  ['get_game_time', {}, 'GET', '/time'],
  ['list_recipes', {}, 'GET', '/crafting/recipes'],
  ['get_factory', { baseId: ID }, 'GET', `/bots/${ID}/factory`],
  ['deploy_base', { password: 'secret1' }, 'POST', '/bots/base', { password: 'secret1' }],
  ['bot_scan', { botId: ID }, 'POST', `/bots/${ID}/actions`, { fn: 'scan', args: [] }],
  ['bot_view', { botId: ID }, 'POST', `/bots/${ID}/actions`, { fn: 'view', args: [] }],
  ['bot_view', { botId: ID, since: 4 }, 'POST', `/bots/${ID}/actions`, { fn: 'view', args: [4] }],
  ['bot_move', { botId: ID, cells: 3 }, 'POST', `/bots/${ID}/actions`, { fn: 'move', args: [3] }],
  ['bot_turn', { botId: ID, direction: 'left' }, 'POST', `/bots/${ID}/actions`, { fn: 'turn', args: ['left'] }],
  ['bot_shoot', { botId: ID, x: 1, y: 2 }, 'POST', `/bots/${ID}/actions`, { fn: 'shoot', args: [1, 2] }],
  ['bot_mine', { botId: ID, x: 1, y: 2 }, 'POST', `/bots/${ID}/actions`, { fn: 'mine', args: [1, 2] }],
  ['bot_drop', { botId: ID }, 'POST', `/bots/${ID}/actions`, { fn: 'drop', args: [] }],
  ['bot_drop', { botId: ID, x: 1, y: 2 }, 'POST', `/bots/${ID}/actions`, { fn: 'drop', args: [1, 2] }],
  ['bot_enable', { botId: ID, moduleId: 'm' }, 'POST', `/bots/${ID}/actions`, { fn: 'enable', args: ['m'] }],
  ['bot_get_location', { botId: ID }, 'POST', `/bots/${ID}/actions`, { fn: 'getLocation', args: [] }],
  ['bot_get_link_status', { botId: ID }, 'POST', `/bots/${ID}/actions`, { fn: 'getLinkStatus', args: [] }],
  [
    'craft_module',
    { baseId: ID, module: 'scanner-class1', count: 2 },
    'POST',
    `/bots/${ID}/factory/craft`,
    { module: 'scanner-class1', count: 2 }
  ],
  ['research_module', { baseId: ID, module: 'x' }, 'POST', `/bots/${ID}/factory/research`, { module: 'x' }],
  ['learn_blueprint', { baseId: ID, itemId: 'i' }, 'POST', `/bots/${ID}/factory/learn`, { itemId: 'i' }],
  [
    'assemble_bot',
    { baseId: ID, partIds: ['a', 'b'] },
    'POST',
    `/bots/${ID}/factory/assemble`,
    { label: null, partIds: ['a', 'b'] }
  ],
  [
    'assemble_bot',
    { baseId: ID, label: 'Scout', partIds: [] },
    'POST',
    `/bots/${ID}/factory/assemble`,
    { label: 'Scout', partIds: [] }
  ],
  [
    'repair_module',
    { botId: ID, targetBotId: 't', moduleId: 'm' },
    'POST',
    `/bots/${ID}/maintenance/repair`,
    { targetBotId: 't', moduleId: 'm' }
  ],
  [
    'disassemble_module',
    { botId: ID, targetBotId: 't', moduleId: 'm' },
    'POST',
    `/bots/${ID}/maintenance/disassemble`,
    { targetBotId: 't', moduleId: 'm' }
  ],
  ['list_drives', { botId: ID }, 'GET', `/bots/${ID}/drives`],
  ['list_files', { botId: ID, driveId: 'd', directory: 'lib' }, 'GET', `/bots/${ID}/drives/d/files?directory=lib`],
  ['read_file', { botId: ID, driveId: 'd', path: 'main.js' }, 'GET', `/bots/${ID}/drives/d/file?path=main.js`],
  [
    'write_file',
    { botId: ID, driveId: 'd', path: 'main.js', content: 'x' },
    'PUT',
    `/bots/${ID}/drives/d/file`,
    { path: 'main.js', content: 'x' }
  ],
  ['delete_file', { botId: ID, driveId: 'd', path: 'main.js' }, 'DELETE', `/bots/${ID}/drives/d/file?path=main.js`],
  [
    'make_directory',
    { botId: ID, driveId: 'd', path: 'lib' },
    'POST',
    `/bots/${ID}/drives/d/directories`,
    { path: 'lib' }
  ],
  ['list_scripts', {}, 'GET', '/executions'],
  [
    'run_script',
    { botId: ID, file: '/m/main.js', args: [1, 'a'] },
    'POST',
    `/bots/${ID}/executions`,
    { file: '/m/main.js', args: [1, 'a'] }
  ],
  ['kill_script', { executionId: 'e1' }, 'DELETE', '/executions/e1']
]

describe('the tools', () => {
  it('each make the call on the API that their name promises', async () => {
    for (const [name, input, method, path, body] of REQUESTS) {
      const { calls, fetchImpl } = fakeApi()
      const tool = allTools.find((candidate) => candidate.name === name)

      await tool?.run(new ApiClient('https://g', 'botrts_k', fetchImpl), input)

      expect({
        name,
        method: calls[0]?.method,
        path: calls[0]?.url.replace('https://g/api/v1', ''),
        body: calls[0]?.body
      }).toEqual({
        name,
        method,
        path,
        body
      })
    }
  })

  it('have unique names, and a scope that exists', () => {
    const names = allTools.map((tool) => tool.name)

    expect(new Set(names).size).toBe(names.length)
    for (const tool of allTools) {
      expect(API_SCOPES).toContain(tool.scope)
      expect(tool.description.length).toBeGreaterThan(20)
    }
  })

  it('cover the manual control of every category the key scopes name', () => {
    const scopes = new Set(allTools.map((tool) => tool.scope))

    for (const scope of [
      'read',
      'base',
      'files',
      'scripts',
      'movement',
      'combat',
      'extraction',
      'fabrication',
      'maintenance'
    ]) {
      expect(scopes).toContain(scope)
    }
    expect(allTools.filter((tool) => tool.name.startsWith('bot_')).map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'bot_scan',
        'bot_move',
        'bot_turn',
        'bot_shoot',
        'bot_dig',
        'bot_pick',
        'bot_take',
        'bot_reload'
      ])
    )
  })

  it('mark observation as read-only and everything that acts as not', () => {
    const byName = Object.fromEntries(allTools.map((tool) => [tool.name, tool]))

    expect(byName.get_map.isReadOnly).toBe(true)
    expect(byName.bot_scan.isReadOnly).toBe(true)
    expect(byName.bot_move.isReadOnly).toBe(false)
    expect(byName.write_file.isReadOnly).toBe(false)
    expect(byName.run_script.isReadOnly).toBe(false)
  })

  it('leave out what has a tool of its own or makes no sense by hand', () => {
    const names = allTools.map((tool) => tool.name)

    for (const left of ['bot_sleep', 'bot_craft', 'bot_assemble', 'bot_read', 'bot_write', 'bot_repair']) {
      expect(names).not.toContain(left)
    }
  })

  it('check their input with their schema', () => {
    const turn = allTools.find((tool) => tool.name === 'bot_turn')

    expect(turn?.inputSchema.direction.safeParse('up').success).toBe(false)
    expect(turn?.inputSchema.direction.safeParse('left').success).toBe(true)
  })

  it('make a tool of any function of the script API, whatever its arguments', async () => {
    const tool = toolOf({
      name: 'fooBar',
      modules: [],
      ops: 1,
      args: [
        { name: 'names', kind: 'stringList' },
        { name: 'label', kind: 'nullableString' },
        { name: 'since', kind: 'integer', isOptional: true }
      ]
    })
    const { calls, fetchImpl } = fakeApi()

    await tool.run(new ApiClient('https://g', 'botrts_k', fetchImpl), { botId: ID, names: ['a'], label: null })

    expect(tool.name).toBe('bot_foo_bar')
    expect(tool.description).not.toContain('Needs one of')
    expect(calls[0].body).toEqual({ fn: 'fooBar', args: [['a'], null] })
    expect(tool.inputSchema.names.safeParse(['a']).success).toBe(true)
    expect(tool.inputSchema.label.safeParse(null).success).toBe(true)
    expect(tool.inputSchema.since.safeParse(undefined).success).toBe(true)
  })
})
