// Migration to 0.2.0: (1) the open phases of the project's plan become folders (a phase index, a file per task, the logs beside them; task 3.10);
// (2) the open-ended phase becomes a normal phase and its defects that have not started become issues of the issue queue (task 3.13), and the profile file
// loses `plan.openEndedPhase` and `plan.openEndedPhaseNumber` and gains `paths.issues`. A phase that is a folder already, a finished phase and a profile
// file without the open-ended phase are left as they are, so the script can run twice. It also removes the skill files of procedures whose switch is off
// (`reports.intake`, `reports.upstream`; task 3.16), which a sync by the tools of an older version wrote for every procedure of the tree. A project with a
// layer map of its own gets the phase folders and the issue queue in the layer of its one-file phases (issue I-3).
import { convertOpenEndedPhase } from '../tools/lib/issue-migration.mjs'
import { splitPhases } from '../tools/lib/phase-split.mjs'
import { layersForPlan } from '../tools/lib/layer-migration.mjs'
import { planSummary } from '../tools/lib/plan.mjs'
import { loadProfile } from '../tools/lib/profile.mjs'
import { inapplicableSkillPaths } from '../tools/lib/skills.mjs'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The skills of the procedures whose switch is off (task 3.16) that a sync by older tools wrote
function removeInapplicableSkills({ root, profile }) {
  const removed = []
  for (const path of inapplicableSkillPaths(profile)) {
    if (existsSync(join(root, path))) {
      rmSync(join(root, path))
      removed.push(path)
      const folder = join(root, dirname(path))
      if (readdirSync(folder).length === 0) rmSync(folder, { recursive: true })
    }
  }
  return removed.length
    ? [`Removed ${removed.length} skill file(s) of procedures whose switch is off: ${removed.join(', ')}.`]
    : []
}

// The globs of the phase folders and of the issue queue, added to the layer map of a project that has one
function addPlanToLayers({ root, profile }) {
  if (!profile.layers) {
    return []
  }
  const path = join(root, profile.paths?.profileFile ?? 'harness-profile.json')
  const { text, added, manual } = layersForPlan(readFileSync(path, 'utf8'), profile)
  if (added.length) {
    writeFileSync(path, text)
  }
  return [
    ...(added.length
      ? [`Added ${added.join(' and ')} to the layer of the one-file phases in \`layers\` of the profile file.`]
      : []),
    ...manual.map(
      (glob) =>
        `Add ${glob} to the layer of the one-file phases in \`layers\` of the profile file by hand; the file could not be edited safely.`
    )
  ]
}

export default ({ root, profile }) => {
  const messages = splitPhases({ root, profile, numbers: null }).messages
  const converted = convertOpenEndedPhase({ root, profile })
  if (converted.length) {
    planSummary({ root, profile: loadProfile(root) })
  }
  return [
    ...messages,
    ...converted,
    ...addPlanToLayers({ root, profile: loadProfile(root) }),
    ...removeInapplicableSkills({ root, profile: loadProfile(root) })
  ]
}
