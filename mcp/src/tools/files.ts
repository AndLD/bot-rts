import { z } from 'zod'
import { botId, defineTool } from './types'

const driveId = z.string().describe('The id of the drive: a memory module of the bot (see list_drives)')
const path = z.string().describe('Path on the drive, with slashes, like scripts/main.js')

export const fileTools = [
  defineTool({
    scope: 'read',
    isReadOnly: true,
    name: 'list_drives',
    title: 'Drives of a bot',
    description: 'The drives (memory modules) of a bot, each with its free space. Files live on drives.',
    inputSchema: { botId },
    run: (client, input) => client.get(`/bots/${input.botId}/drives`)
  }),
  defineTool({
    scope: 'read',
    isReadOnly: true,
    name: 'list_files',
    title: 'List files',
    description: 'The files and directories of a drive, in one directory (the top by default).',
    inputSchema: { botId, driveId, directory: z.string().optional() },
    run: (client, input) =>
      client.get(`/bots/${input.botId}/drives/${input.driveId}/files`, { directory: input.directory })
  }),
  defineTool({
    scope: 'read',
    isReadOnly: true,
    name: 'read_file',
    title: 'Read a file',
    description: 'The content of a file on a drive.',
    inputSchema: { botId, driveId, path },
    run: (client, input) => client.get(`/bots/${input.botId}/drives/${input.driveId}/file`, { path: input.path })
  }),
  defineTool({
    scope: 'files',
    name: 'write_file',
    title: 'Write a file',
    description:
      'Creates or replaces a file on a drive, for example a script to run with run_script. A drive has a quota; the write fails when it is full.',
    inputSchema: { botId, driveId, path, content: z.string() },
    run: (client, input) =>
      client.put(`/bots/${input.botId}/drives/${input.driveId}/file`, { path: input.path, content: input.content })
  }),
  defineTool({
    scope: 'files',
    name: 'delete_file',
    title: 'Delete a file',
    description: 'Deletes a file, or an empty directory.',
    inputSchema: { botId, driveId, path },
    run: (client, input) => client.delete(`/bots/${input.botId}/drives/${input.driveId}/file`, { path: input.path })
  }),
  defineTool({
    scope: 'files',
    name: 'make_directory',
    title: 'Make a directory',
    description: 'Creates a directory on a drive (one level at a time).',
    inputSchema: { botId, driveId, path },
    run: (client, input) =>
      client.post(`/bots/${input.botId}/drives/${input.driveId}/directories`, { path: input.path })
  })
]
