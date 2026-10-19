// The implementation log of a phase, written from the merged pull requests instead of by hand (method, session protocol): the squash
// commits on the integration branch carry the plan task ids in a `Plan: <id>[, <id>]` line of their body, and the pull request number
// in the subject.
const PLAN_LINE = /^Plan:\s*(.+)$/gm

// `commits` are { subject, body, date } of the commits on the integration branch, newest first. Returns the rows of the phase,
// oldest first: { tasks, pr, title, date }.
export function implementationRows(commits, phase) {
  const rows = []

  for (const { subject, body, date } of commits) {
    const tasks = [...body.matchAll(PLAN_LINE)]
      .flatMap((match) => match[1].split(/[,\s]+/))
      .filter((task) => task.startsWith(`${phase}.`))
    const pr = /\(#(\d+)\)\s*$/.exec(subject)?.[1]
    if (!tasks.length || !pr) {
      continue
    }
    rows.push({
      tasks: [...new Set(tasks)].sort(compareTasks),
      pr,
      title: subject.replace(/\s*\(#\d+\)\s*$/, ''),
      date: date.slice(0, 10)
    })
  }

  return rows.reverse()
}

// 15.4 before 15.10, 15.9 before 15.9a
function compareTasks(a, b) {
  const [, minorA = '0'] = a.split('.')
  const [, minorB = '0'] = b.split('.')
  return parseInt(minorA, 10) - parseInt(minorB, 10) || minorA.localeCompare(minorB)
}

// The table, with links to the pull requests of `repoUrl`
export function implementationLog(rows, repoUrl) {
  const lines = ['| Tasks | PR | Change | Merged |', '| ----- | -- | ------ | ------ |']

  for (const { tasks, pr, title, date } of rows) {
    lines.push(`| ${tasks.join(', ')} | [#${pr}](${repoUrl}/pull/${pr}) | ${title.replace(/\|/g, '\\|')} | ${date} |`)
  }

  return lines.join('\n')
}
