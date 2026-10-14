import { z } from 'zod'
import { botId, defineTool } from './types'

export const scriptTools = [
  defineTool({
    scope: 'read',
    isReadOnly: true,
    name: 'list_scripts',
    title: 'Running scripts',
    description: 'The scripts of the player that are running now, with their state.',
    inputSchema: {},
    run: (client) => client.get('/executions')
  }),
  defineTool({
    scope: 'scripts',
    name: 'run_script',
    title: 'Run a script',
    description:
      'Starts `main(bot, ...args)` of a script file on a bot. The file is addressed as /<drive>/<path>, for example /memory-class1/main.js. Its output goes to the terminal history (get_terminal_history). A bot runs a limited number of scripts at once; the rest wait.',
    inputSchema: {
      botId,
      file: z.string().describe('/<drive>/<path> of the script'),
      args: z
        .array(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('Arguments of main')
    },
    run: (client, input) => client.post(`/bots/${input.botId}/executions`, { file: input.file, args: input.args })
  }),
  defineTool({
    scope: 'scripts',
    name: 'kill_script',
    title: 'Stop a script',
    description: 'Stops a running script.',
    inputSchema: { executionId: z.string().describe('The id from run_script or list_scripts') },
    run: (client, input) => client.delete(`/executions/${input.executionId}`)
  })
]
