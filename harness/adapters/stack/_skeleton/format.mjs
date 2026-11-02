// The formatter of this stack (contract role "formatter"): how to format one edited file, run from the project's own installation and never downloaded.
// Returns `{ command, args }` (the args name the file), or null for a file this stack does not format.
export function formatCommand({ path }) {
  throw new Error('TODO: write the formatter command of this stack')
}
